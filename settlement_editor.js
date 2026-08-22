/**
 * ============================================================================
 * SETTLEMENT_EDITOR.JS - Settlement & POI Customizer, Placer, & Auto-Populator
 * ============================================================================
 * Handles manual placement, customization, road/nautical auto-connections,
 * real-time jurisdiction calculation, and zone-based settlement auto-population.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SettlementEditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const SETTLEMENT_TYPES = [
    { value: 'capital', label: '👑 Capital City (Grand Seat)' },
    { value: 'city',    label: '🏰 Major City (Duchy Seat)' },
    { value: 'town',    label: '🏘️ Walled Town (Barony Seat)' },
    { value: 'village', label: '🏡 Village (Rural)' },
    { value: 'hamlet',  label: '🛖 Hamlet (Crossroads)' },
    { value: 'port',    label: '⚓ Coastal Port / Harbor' },
    { value: 'fort',    label: '🛡️ Border Fort / Citadel' },
    { value: 'spire',   label: '✨ Arcane Spire' },
    { value: 'mine',    label: '⛏️ Mine / Quarry' },
    { value: 'ruins',   label: '🏛️ Ancient Ruins' }
  ];

  class SettlementEditorEngine {
    constructor() {
      this.selectedType = 'town';
      this.customName = 'Highford';
      this.autoConnect = true;

      // Auto-population configuration
      this.autoPopTier = 'grand';
      this.autoPopZoneId = 'all';
      this.autoPopCount = 10;

      // Currently inspected/selected settlement node
      this.selectedNode = null;

      this.getWorldData = null;
      this.onRenderRequest = null;
    }

    init(options = {}) {
      this.getWorldData = options.getWorldData;
      this.onRenderRequest = options.onRenderRequest;

      this.bindUI();
      this.refreshAutoPopZoneDropdown();
      this.randomizeName();
    }

    // --- Name & Culture Resolution ---
    getZoneCultureAt(gx, gy) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return 'medieval';

      const idx = gy * worldData.gw + gx;
      const gId = worldData.grandState ? worldData.grandState[idx] : -1;
      if (gId >= 0 && worldData.grandZones && worldData.grandZones[gId]) {
        return worldData.grandZones[gId].culture || 'medieval';
      }
      return 'medieval';
    }

    randomizeName(culture = null) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      const rng = typeof WorldGen !== 'undefined'
        ? new WorldGen.SeededRandom('loc_' + Date.now() + '_' + Math.random())
        : { next: () => Math.random() };

      const chosenCulture = culture || 'medieval';
      let generated = "Settlement";

      if (typeof WorldNames !== 'undefined' && WorldNames.THEME_POOLS) {
        const pool = WorldNames.THEME_POOLS[chosenCulture] || WorldNames.THEME_POOLS.medieval;
        if (['capital', 'city', 'town', 'village', 'hamlet'].includes(this.selectedType)) {
          const p = pool.prefixes[Math.floor(rng.next() * pool.prefixes.length)];
          const s = pool.suffixes[Math.floor(rng.next() * pool.suffixes.length)];
          generated = p + s;
          if (this.selectedType === 'hamlet' && rng.next() < 0.6) {
            const hp = WorldNames.HAMLET_PREFIXES[Math.floor(rng.next() * WorldNames.HAMLET_PREFIXES.length)] || "Old";
            generated = `${hp} ${generated}`;
          }
        } else {
          const p = pool.prefixes[Math.floor(rng.next() * pool.prefixes.length)];
          const s = pool.suffixes[Math.floor(rng.next() * pool.suffixes.length)];
          const base = p + s;
          const descriptors = WorldNames.POI_DESCRIPTORS[this.selectedType] || ["Outpost"];
          const desc = descriptors[Math.floor(rng.next() * descriptors.length)] || "Outpost";
          generated = `${base} ${desc}`;
        }
      }

      this.customName = generated;
      const nameInput = document.getElementById('settlementCustomName');
      if (nameInput) nameInput.value = generated;
      return generated;
    }

    // --- Real-time Jurisdiction Detection ---
    getJurisdictionInfo(gx, gy) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData || !worldData.grandState) return { realmStr: "Wilderness", gZone: null, mZone: null, sZone: null };

      const idx = gy * worldData.gw + gx;
      const gId = worldData.grandState[idx];
      const mId = worldData.medState ? worldData.medState[idx] : -1;
      const sId = worldData.smallState ? worldData.smallState[idx] : -1;

      const gZone = (gId >= 0 && worldData.grandZones) ? worldData.grandZones.find(z => z.id === gId) : null;
      const mZone = (mId >= 0 && worldData.medZones) ? worldData.medZones.find(z => z.id === mId) : null;
      const sZone = (sId >= 0 && worldData.smallZones) ? worldData.smallZones.find(z => z.id === sId) : null;

      let realmStr = "";
      if (sZone) realmStr += sZone.name;
      if (mZone) realmStr += (realmStr ? " • " : "") + mZone.name;
      if (gZone) realmStr += (realmStr ? " • " : "") + gZone.name;

      return {
        realmStr: realmStr || "Unclaimed Frontier",
        gZone, mZone, sZone
      };
    }

    updateHoverJurisdiction(gx, gy) {
      const labelElem = document.getElementById('settlementHoverJurisdiction');
      if (!labelElem) return;
      const info = this.getJurisdictionInfo(gx, gy);
      labelElem.innerText = info.realmStr;
    }

    // --- Automatic Road & Nautical Connections ---
    connectToRoadNetwork(newNode) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const { gw, gh, elevation, isWater, hasRoad, STEP } = worldData;
      const allExisting = (worldData.allNodes || []).filter(n => n !== newNode && n.type !== 'character');
      if (allExisting.length === 0) return;

      // 1. NAUTICAL SEA CONNECTION FOR PORTS
      if (newNode.type === 'port') {
        const portsOnSameWater = allExisting.filter(n => 
          (n.type === 'port' || n.waterBodyId !== -1) && 
          n.waterBodyId === newNode.waterBodyId
        );

        let target = portsOnSameWater.sort((a, b) => 
          Math.hypot(a.x - newNode.x, a.y - newNode.y) - Math.hypot(b.x - newNode.x, b.y - newNode.y)
        )[0];

        if (target && typeof WorldGen !== 'undefined') {
          const rawWater = WorldGen.findNauticalSeaRoute(newNode, target, isWater, gw, gh);
          if (rawWater && rawWater.length > 1) {
            const smoothWater = WorldGen.smoothPathChaikin(rawWater, 2);
            worldData.waterRoutePaths.push(smoothWater);

            if (worldData.roadGraph) {
              if (!worldData.roadGraph.has(newNode)) worldData.roadGraph.set(newNode, []);
              if (!worldData.roadGraph.has(target)) worldData.roadGraph.set(target, []);
              worldData.roadGraph.get(newNode).push({ target, path: smoothWater, type: 'water' });
              worldData.roadGraph.get(target).push({ target: newNode, path: [...smoothWater].reverse(), type: 'water' });
            }
          }
        }
      }

      // 2. LAND ROAD CONNECTION
      const sameCompNodes = allExisting.filter(n => n.compId === newNode.compId);
      if (sameCompNodes.length === 0) return;

      // Find closest node on the same landmass
      const closestTarget = sameCompNodes.sort((a, b) => 
        Math.hypot(a.x - newNode.x, a.y - newNode.y) - Math.hypot(b.x - newNode.x, b.y - newNode.y)
      )[0];

      if (closestTarget && typeof WorldGen !== 'undefined') {
        const rawPath = WorldGen.findSmartRoad(newNode, closestTarget, elevation, isWater, hasRoad, gw, gh);
        if (rawPath && rawPath.length > 1) {
          const smoothPath = WorldGen.smoothPathChaikin(rawPath, 2);

          const isMajor = ['capital', 'city', 'fort', 'port'].includes(newNode.type);
          if (isMajor) {
            worldData.majorRoadPaths.push(smoothPath);
          } else {
            worldData.minorRoadPaths.push(smoothPath);
          }

          if (worldData.roadGraph) {
            if (!worldData.roadGraph.has(newNode)) worldData.roadGraph.set(newNode, []);
            if (!worldData.roadGraph.has(closestTarget)) worldData.roadGraph.set(closestTarget, []);
            worldData.roadGraph.get(newNode).push({ target: closestTarget, path: smoothPath, type: 'road' });
            worldData.roadGraph.get(closestTarget).push({ target: newNode, path: [...smoothPath].reverse(), type: 'road' });
          }
        }
      }
    }

    // --- Place Single Settlement / POI ---
    placeSettlement(gx, gy, canvasX, canvasY) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const idx = gy * worldData.gw + gx;
      const isWaterCell = worldData.isWater[idx] === 1;

      // Ports can be placed on coast; other settlements must be on land
      if (this.selectedType !== 'port' && isWaterCell) {
        alert("Land settlements must be placed on dry land!");
        return;
      }

      const compId = worldData.componentId ? worldData.componentId[idx] : 0;
      const waterBodyId = worldData.waterBodyId ? worldData.waterBodyId[idx] : -1;

      const newNode = {
        id: `node_custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        x: gx,
        y: gy,
        px: canvasX,
        py: canvasY,
        elevation: worldData.elevation[idx],
        type: this.selectedType,
        tier: this.selectedType,
        name: this.customName || this.randomizeName(this.getZoneCultureAt(gx, gy)),
        compId: compId >= 0 ? compId : 0,
        waterBodyId: waterBodyId,
        charactersInLocation: []
      };

      // Add to category buckets
      if (this.selectedType === 'capital') {
        worldData.capitals.push(newNode);
      } else {
        worldData.pois.push(newNode);
      }
      worldData.allNodes.push(newNode);

      // Auto-connect roads/routes
      if (this.autoConnect) {
        this.connectToRoadNetwork(newNode);
      }

      // Refresh map and UI
      this.randomizeName(this.getZoneCultureAt(gx, gy));
      if (typeof populateSidebarList === 'function') populateSidebarList();
      if (this.onRenderRequest) this.onRenderRequest(true);
    }

    // --- Auto-Populate Selected Zone with Town Types Only ---
  // --- Town Name Generator ---
    generateTownName(tier, culture = 'medieval', rng = null) {
      const r = rng || (typeof WorldGen !== 'undefined' 
        ? new WorldGen.SeededRandom('town_' + Date.now() + '_' + Math.random()) 
        : { next: () => Math.random() });

      if (typeof WorldNames !== 'undefined' && WorldNames.THEME_POOLS) {
        const pool = WorldNames.THEME_POOLS[culture] || WorldNames.THEME_POOLS.medieval || { prefixes: ['High'], suffixes: ['ford'] };
        if (pool.stems && pool.stems.length > 0 && r.next() < 0.35) {
          return pool.stems[Math.floor(r.next() * pool.stems.length)];
        }
        const p = pool.prefixes[Math.floor(r.next() * pool.prefixes.length)];
        const s = pool.suffixes[Math.floor(r.next() * pool.suffixes.length)];
        let base = p + s;
        if (tier === 'hamlet' && r.next() < 0.65) {
          const hpList = WorldNames.HAMLET_PREFIXES || ['Little', 'Old', 'Upper', 'Lower', 'West', 'East'];
          const hp = hpList[Math.floor(r.next() * hpList.length)];
          base = `${hp} ${base}`;
        }
        return base;
      }
      return `${tier.charAt(0).toUpperCase() + tier.slice(1)} ${Math.floor(r.next() * 900 + 100)}`;
    }

    // --- Auto-Populate Selected Zone with Town Types Only ---
    autoPopulateSelectedZone() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const { gw, gh, STEP, elevation, isWater, grandState, medState, smallState, grandZones, medZones, smallZones } = worldData;
      const totalCells = gw * gh;

      let targetZone = null;
      let stateArray = null;
      let culture = 'medieval';

      if (this.autoPopTier === 'grand') {
        stateArray = grandState;
        targetZone = (grandZones || []).find(z => z.id === this.autoPopZoneId);
        culture = targetZone ? targetZone.culture : 'medieval';
      } else if (this.autoPopTier === 'med') {
        stateArray = medState;
        targetZone = (medZones || []).find(z => z.id === this.autoPopZoneId);
        const parentGrand = targetZone && targetZone.grandId >= 0 ? (grandZones || []).find(z => z.id === targetZone.grandId) : null;
        culture = parentGrand ? parentGrand.culture : 'medieval';
      } else {
        stateArray = smallState;
        targetZone = (smallZones || []).find(z => z.id === this.autoPopZoneId);
        culture = 'medieval';
      }

      if (!targetZone) {
        alert("Please select a valid zone from the dropdown to populate!");
        return;
      }

      const validCells = [];
      for (let idx = 0; idx < totalCells; idx++) {
        if (!isWater[idx] && stateArray && stateArray[idx] === targetZone.id) {
          const e = elevation[idx];
          if (e >= 0.44 && e <= 0.82) {
            validCells.push(idx);
          }
        }
      }

      if (validCells.length < 5) {
        alert("The selected zone does not have enough land territory to populate settlements!");
        return;
      }

      const rng = typeof WorldGen !== 'undefined' 
        ? new WorldGen.SeededRandom(`autopop_${targetZone.id}_${Date.now()}`)
        : { next: () => Math.random() };

      const townTiers = ['town', 'village', 'village', 'hamlet', 'hamlet'];
      if (this.autoPopTier === 'grand') townTiers.unshift('city');

      let spawnedCount = 0;
      let attempts = 0;
      const minDistance = Math.max(14, Math.min(50, Math.sqrt(validCells.length / this.autoPopCount)));

      while (spawnedCount < this.autoPopCount && attempts < this.autoPopCount * 40) {
        attempts++;
        const randIdx = validCells[Math.floor(rng.next() * validCells.length)];
        const cx = randIdx % gw;
        const cy = Math.floor(randIdx / gw);
        const px = cx * STEP + STEP / 2;
        const py = cy * STEP + STEP / 2;

        const tooClose = (worldData.allNodes || []).some(n => Math.hypot(n.x - cx, n.y - cy) < minDistance);
        if (tooClose) continue;

        const tier = townTiers[spawnedCount % townTiers.length];
        const name = this.generateTownName(tier, culture, rng);

        const compId = worldData.componentId ? worldData.componentId[randIdx] : 0;
        const newNode = {
          id: `node_pop_${Date.now()}_${spawnedCount}_${Math.floor(Math.random() * 1000)}`,
          x: cx,
          y: cy,
          px: px,
          py: py,
          elevation: elevation[randIdx],
          type: tier,
          tier: tier,
          name: name,
          compId: compId >= 0 ? compId : 0,
          charactersInLocation: []
        };

        if (!worldData.pois) worldData.pois = [];
        if (!worldData.allNodes) worldData.allNodes = [];

        worldData.pois.push(newNode);
        worldData.allNodes.push(newNode);

        if (this.autoConnect) {
          this.connectToRoadNetwork(newNode);
        }

        spawnedCount++;
      }

      alert(`Successfully populated ${spawnedCount} town settlements inside ${targetZone.name}!`);
      if (typeof populateSidebarList === 'function') populateSidebarList();
      if (this.onRenderRequest) this.onRenderRequest(true);
    }
    // --- Delete Selected Settlement ---
    deleteSelectedSettlement() {
      if (!this.selectedNode) return;
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const nodeToDelete = this.selectedNode;

      // Remove from all array buckets
      worldData.allNodes = worldData.allNodes.filter(n => n !== nodeToDelete);
      worldData.pois = worldData.pois.filter(n => n !== nodeToDelete);
      worldData.capitals = worldData.capitals.filter(n => n !== nodeToDelete);

      // Clean up road graph edges
      if (worldData.roadGraph && worldData.roadGraph.has(nodeToDelete)) {
        worldData.roadGraph.delete(nodeToDelete);
        worldData.roadGraph.forEach((edges, key) => {
          worldData.roadGraph.set(key, edges.filter(e => e.target !== nodeToDelete));
        });
      }

      this.selectedNode = null;
      document.getElementById('settlementInspectBox').style.display = 'none';

      if (typeof populateSidebarList === 'function') populateSidebarList();
      if (this.onRenderRequest) this.onRenderRequest(true);
    }

    refreshAutoPopZoneDropdown() {
      const select = document.getElementById('autoPopZoneSelect');
      if (!select) return;

      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      let list = [];
      if (this.autoPopTier === 'grand') list = worldData.grandZones || [];
      else if (this.autoPopTier === 'med') list = worldData.medZones || [];
      else list = worldData.smallZones || [];

      select.innerHTML = list.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
      if (list.length > 0) {
        this.autoPopZoneId = list[0].id;
      }
    }

    bindUI() {
      // Settlement Type Selector
      const typeSelect = document.getElementById('settlementTypeSelect');
      if (typeSelect) {
        typeSelect.innerHTML = SETTLEMENT_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
        typeSelect.value = this.selectedType;
        typeSelect.addEventListener('change', (e) => {
          this.selectedType = e.target.value;
          this.randomizeName();
        });
      }

      const nameInput = document.getElementById('settlementCustomName');
      if (nameInput) {
        nameInput.addEventListener('input', (e) => { this.customName = e.target.value; });
      }

      const randBtn = document.getElementById('settlementRandomNameBtn');
      if (randBtn) {
        randBtn.addEventListener('click', () => this.randomizeName());
      }

      const connectCb = document.getElementById('settlementAutoConnectCb');
      if (connectCb) {
        connectCb.addEventListener('change', (e) => { this.autoConnect = e.target.checked; });
      }

      // Auto-Pop Tier Selector
      document.querySelectorAll('.autopop-tier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.autoPopTier = btn.getAttribute('data-aptier');
          document.querySelectorAll('.autopop-tier-btn').forEach(b => {
            b.style.borderColor = '#3d3448';
            b.style.background = '#1a1622';
          });
          btn.style.borderColor = '#f1c40f';
          btn.style.background = '#342918';

          this.refreshAutoPopZoneDropdown();
        });
      });

      const autoPopSelect = document.getElementById('autoPopZoneSelect');
      if (autoPopSelect) {
        autoPopSelect.addEventListener('change', (e) => {
          this.autoPopZoneId = parseInt(e.target.value);
        });
      }

      const autoPopCountInput = document.getElementById('autoPopCountInput');
      if (autoPopCountInput) {
        autoPopCountInput.addEventListener('input', (e) => {
          this.autoPopCount = Math.max(1, Math.min(50, parseInt(e.target.value) || 10));
        });
      }

      const autoPopExecBtn = document.getElementById('autoPopExecuteBtn');
      if (autoPopExecBtn) {
        autoPopExecBtn.addEventListener('click', () => this.autoPopulateSelectedZone());
      }

      const deleteBtn = document.getElementById('settlementDeleteBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteSelectedSettlement());
      }
    }
  }

  return new SettlementEditorEngine();
}));
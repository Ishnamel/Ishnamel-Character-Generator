/**
 * ============================================================================
 * ZONE_EDITOR.JS - Interactive 3-Tier Political & Territorial Zone Painter
 * ============================================================================
 * Handles painting, erasing, dynamic parent adoption, custom color picking,
 * label placement, and ghost label cleanup.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ZoneEditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  function hexToRgb(hex) {
    hex = String(hex || '#e74c3c').replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16) || 0;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHex(r, g, b) {
    const toHex = (c) => ('0' + Math.max(0, Math.min(255, Math.round(c || 0))).toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function createZoneColorObject(hex, alpha = 0.40) {
    const rgb = hexToRgb(hex);
    return {
      fillR: rgb.r,
      fillG: rgb.g,
      fillB: rgb.b,
      alpha: alpha,
      borderR: Math.min(255, Math.round(rgb.r * 1.25 + 20)),
      borderG: Math.min(255, Math.round(rgb.g * 1.25 + 20)),
      borderB: Math.min(255, Math.round(rgb.b * 1.25 + 20)),
      nameColor: rgbToHex(Math.min(255, rgb.r + 70), Math.min(255, rgb.g + 70), Math.min(255, rgb.b + 70))
    };
  }

  class ZoneEditorEngine {
    constructor() {
      this.currentTier = 'grand'; // 'grand', 'med', 'small'
      this.currentMode = 'paint'; // 'paint', 'erase'
      this.selectedZoneId = null;

      this.currentTitle = "Kingdom of";
      this.currentName = "Eldoria";
      this.currentRank = "kingdom";
      this.currentCulture = "medieval";
      this.customColorHex = "#e74c3c";

      this.getWorldData = null;
      this.onRenderRequest = null;
    }

    init(options = {}) {
      this.getWorldData = options.getWorldData;
      this.onRenderRequest = options.onRenderRequest;

      this.bindUI();
      this.refreshZoneDropdowns();
      this.updateTitleDropdown();
    }

    getRandomZoneName() {
      const rng = typeof WorldGen !== 'undefined' 
        ? new WorldGen.SeededRandom('zone_' + Date.now() + '_' + Math.random()) 
        : { next: () => Math.random() };
      
      const themeKeys = (typeof WorldNames !== 'undefined' && WorldNames.THEME_KEYS) 
        ? WorldNames.THEME_KEYS 
        : ["medieval", "nordic", "celtic", "slavic", "romance", "germanic", "arcane"];
      
      this.currentCulture = themeKeys[Math.floor(rng.next() * themeKeys.length)];

      if (typeof WorldNames !== 'undefined' && WorldNames.THEME_POOLS) {
        const pool = WorldNames.THEME_POOLS[this.currentCulture] || WorldNames.THEME_POOLS.medieval;
        if (pool.stems && pool.stems.length > 0 && rng.next() < 0.35) {
          return pool.stems[Math.floor(rng.next() * pool.stems.length)];
        }
        const p = pool.prefixes[Math.floor(rng.next() * pool.prefixes.length)];
        const s = pool.suffixes[Math.floor(rng.next() * pool.suffixes.length)];
        return p + s;
      }
      return "Realm" + Math.floor(Math.random() * 900 + 100);
    }

    getRandomHexColor() {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    }

    getTitleOptionsForTier(tier) {
      if (typeof WorldNames === 'undefined' || !WorldNames.HIERARCHY_TITLES) {
        if (tier === 'grand') return ["Kingdom of", "Empire of", "Republic of", "Dominion of"];
        if (tier === 'med') return ["Duchy of", "Grand Duchy of", "Province of", "State of"];
        return ["Barony of", "County of", "Lordship of", "Viscounty of"];
      }

      if (tier === 'grand') {
        const titles = [];
        Object.keys(WorldNames.HIERARCHY_TITLES).forEach(k => {
          titles.push(...WorldNames.HIERARCHY_TITLES[k].grand);
        });
        return [...new Set(titles)];
      } else if (tier === 'med') {
        const titles = [];
        Object.keys(WorldNames.HIERARCHY_TITLES).forEach(k => {
          WorldNames.HIERARCHY_TITLES[k].medium.forEach(m => titles.push(...m.titles));
        });
        return [...new Set(titles)];
      } else {
        const titles = [];
        Object.keys(WorldNames.SMALL_TITLE_FORMATS).forEach(k => {
          titles.push(...WorldNames.SMALL_TITLE_FORMATS[k]);
        });
        return [...new Set(titles)];
      }
    }

    updateTitleDropdown() {
      const select = document.getElementById('zoneTitleSelect');
      if (!select) return;

      const titles = this.getTitleOptionsForTier(this.currentTier);
      select.innerHTML = titles.map(t => `<option value="${t}">${t}</option>`).join('');
      this.currentTitle = titles[0] || "";
    }

    randomizeCurrentForm() {
      this.currentName = this.getRandomZoneName();
      const nameInput = document.getElementById('zoneCustomName');
      if (nameInput) nameInput.value = this.currentName;

      this.customColorHex = this.getRandomHexColor();
      const colorInput = document.getElementById('zoneColorPicker');
      if (colorInput) colorInput.value = this.customColorHex;
    }

    getNextUniqueId(list) {
      if (!list || list.length === 0) return 0;
      let max = -1;
      for (let item of list) {
        if (item && item.id > max) max = item.id;
      }
      return max + 1;
    }

    createNewZone() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const colorInput = document.getElementById('zoneColorPicker');
      const hex = colorInput ? colorInput.value : this.customColorHex;
      const fullName = `${this.currentTitle} ${this.currentName}`.trim();

      const alpha = this.currentTier === 'grand' ? 0.40 : (this.currentTier === 'med' ? 0.40 : 0.42);
      const colorObj = createZoneColorObject(hex, alpha);

      if (this.currentTier === 'grand') {
        const newId = this.getNextUniqueId(worldData.grandZones);
        const newGrand = {
          id: newId,
          rank: this.currentRank,
          culture: this.currentCulture,
          name: fullName,
          shortName: this.currentName,
          color: colorObj,
          capital: null, // Null until actually painted
          cellCount: 0,
          compId: 0
        };
        worldData.grandZones.push(newGrand);
        this.selectedZoneId = newId;

      } else if (this.currentTier === 'med') {
        const newId = this.getNextUniqueId(worldData.medZones);
        const newMed = {
          id: newId,
          grandId: -1, // Dynamically locked on first stroke
          name: fullName,
          capital: null,
          cellCount: 0,
          medDef: { titles: [this.currentTitle], smallTypes: ["barony", "county"] },
          isCapitalZone: false,
          color: colorObj
        };
        worldData.medZones.push(newMed);
        this.selectedZoneId = newId;

      } else if (this.currentTier === 'small') {
        const newId = this.getNextUniqueId(worldData.smallZones);
        const newSmall = {
          id: newId,
          medId: -1, // Dynamically locked on first stroke
          name: fullName,
          capital: null,
          cellCount: 0,
          isCapitalZone: false,
          color: colorObj
        };
        worldData.smallZones.push(newSmall);
        this.selectedZoneId = newId;
      }

      this.refreshZoneDropdowns();
      this.randomizeCurrentForm();
    }

    refreshZoneDropdowns() {
      const select = document.getElementById('activeZoneSelect');
      if (!select) return;

      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      let list = [];
      if (this.currentTier === 'grand') list = worldData.grandZones;
      else if (this.currentTier === 'med') list = worldData.medZones;
      else list = worldData.smallZones;

      select.innerHTML = '<option value="new">+ [ Create New Zone ]</option>';
      list.forEach(z => {
        if (z && z.name) {
          const countInfo = z.cellCount !== undefined ? ` (${z.cellCount} cells)` : '';
          select.innerHTML += `<option value="${z.id}">${z.name}${countInfo}</option>`;
        }
      });

      let activeZone = null;
      if (this.selectedZoneId !== null && list.find(z => z.id === this.selectedZoneId)) {
        select.value = this.selectedZoneId;
        activeZone = list.find(z => z.id === this.selectedZoneId);
      } else if (list.length > 0) {
        select.value = list[list.length - 1].id;
        this.selectedZoneId = list[list.length - 1].id;
        activeZone = list[list.length - 1];
      } else {
        select.value = "new";
        this.selectedZoneId = null;
      }

      const colorInput = document.getElementById('zoneColorPicker');
      if (colorInput && activeZone && activeZone.color) {
        colorInput.value = rgbToHex(activeZone.color.fillR, activeZone.color.fillG, activeZone.color.fillB);
      }
    }

   applyZoneStroke(centerGx, centerGy, radius) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const { gw, gh, isWater, grandState, medState, smallState, grandZones, medZones, smallZones } = worldData;
      const R = radius;
      const R2 = R * R;

      const minX = Math.max(1, centerGx - R);
      const maxX = Math.min(gw - 2, centerGx + R);
      const minY = Math.max(1, centerGy - R);
      const maxY = Math.min(gh - 2, centerGy + R);

      if (minX > maxX || minY > maxY) return;

      if (this.currentMode === 'paint' && (this.selectedZoneId === null || this.selectedZoneId === 'new')) {
        this.createNewZone();
      }

      let targetZone = null;
      if (this.currentTier === 'grand') targetZone = grandZones.find(z => z.id === this.selectedZoneId);
      else if (this.currentTier === 'med') targetZone = medZones.find(z => z.id === this.selectedZoneId);
      else targetZone = smallZones.find(z => z.id === this.selectedZoneId);

      // 1. LOCK PARENT ZONE ONCE AT BRUSH CENTER (BEFORE ENTERING PIXEL LOOP)
      if (this.currentMode === 'paint' && targetZone) {
        const centerIdx = centerGy * gw + centerGx;

        if (this.currentTier === 'med') {
          // If medium zone has no parent yet or has 0 cells, lock to the Grand Zone under cursor center
          if (targetZone.grandId === -1 || targetZone.grandId === undefined || targetZone.cellCount === 0) {
            let parentGrand = grandState[centerIdx];
            // If cursor center is in water, find closest land cell inside brush
            if (parentGrand === -1 || isWater[centerIdx]) {
              for (let dy = -R; dy <= R; dy++) {
                for (let dx = -R; dx <= R; dx++) {
                  const tx = centerGx + dx, ty = centerGy + dy;
                  if (tx >= 1 && tx < gw - 1 && ty >= 1 && ty < gh - 1) {
                    const tidx = ty * gw + tx;
                    if (!isWater[tidx] && grandState[tidx] !== -1) {
                      parentGrand = grandState[tidx];
                      break;
                    }
                  }
                }
                if (parentGrand !== -1) break;
              }
            }
            if (parentGrand !== -1) {
              targetZone.grandId = parentGrand;
            }
          }
        } else if (this.currentTier === 'small') {
          // If small zone has no parent yet or has 0 cells, lock to the Medium Zone under cursor center
          if (targetZone.medId === -1 || targetZone.medId === undefined || targetZone.cellCount === 0) {
            let parentMed = medState[centerIdx];
            if (parentMed === -1 || isWater[centerIdx]) {
              for (let dy = -R; dy <= R; dy++) {
                for (let dx = -R; dx <= R; dx++) {
                  const tx = centerGx + dx, ty = centerGy + dy;
                  if (tx >= 1 && tx < gw - 1 && ty >= 1 && ty < gh - 1) {
                    const tidx = ty * gw + tx;
                    if (!isWater[tidx] && medState[tidx] !== -1) {
                      parentMed = medState[tidx];
                      break;
                    }
                  }
                }
                if (parentMed !== -1) break;
              }
            }
            if (parentMed !== -1) {
              targetZone.medId = parentMed;
            }
          }
        }
      }

      // 2. PIXEL LOOP WITH STRICT BORDER ENFORCEMENT
      let cellsChanged = 0;

      for (let y = minY; y <= maxY; y++) {
        const yOffset = y * gw;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - centerGx;
          const dy = y - centerGy;
          if (dx * dx + dy * dy > R2) continue;

          const idx = yOffset + x;
          if (isWater[idx] === 1) continue;

          if (this.currentMode === 'erase') {
            if (this.currentTier === 'grand') {
              grandState[idx] = -1;
              medState[idx] = -1;
              smallState[idx] = -1;
            } else if (this.currentTier === 'med') {
              medState[idx] = -1;
              smallState[idx] = -1;
            } else {
              smallState[idx] = -1;
            }
          } else if (targetZone) {
            if (this.currentTier === 'grand') {
              if (grandState[idx] !== targetZone.id) {
                medState[idx] = -1;
                smallState[idx] = -1;
              }
              grandState[idx] = targetZone.id;
              cellsChanged++;

            } else if (this.currentTier === 'med') {
              // STRICT CHECK: Disallow painting outside the adopted Grand Zone
              if (targetZone.grandId === -1 || targetZone.grandId === undefined) continue;
              if (grandState[idx] !== targetZone.grandId) continue; // Stops at neighboring Grand Zone border!

              if (medState[idx] !== targetZone.id) {
                smallState[idx] = -1;
              }
              medState[idx] = targetZone.id;
              cellsChanged++;

            } else if (this.currentTier === 'small') {
              // STRICT CHECK: Disallow painting outside the adopted Medium Zone
              if (targetZone.medId === -1 || targetZone.medId === undefined) continue;
              if (medState[idx] !== targetZone.medId) continue; // Stops at neighboring Medium Zone border!

              smallState[idx] = targetZone.id;
              cellsChanged++;
            }
          }
        }
      }

      if (cellsChanged > 0 && targetZone) {
        targetZone.cellCount = (targetZone.cellCount || 0) + cellsChanged;
      }

      this.syncActiveZoneTexture();
    }

    cleanupAndRecalculateLabels() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const { gw, gh, STEP, grandState, medState, smallState, grandZones, medZones, smallZones } = worldData;
      const totalCells = gw * gh;

      function processTier(zonesList, stateArray, parentStateArray, parentKey) {
        for (let i = 0; i < zonesList.length; i++) {
          const zone = zonesList[i];
          if (!zone) continue;

          let cellCount = 0;
          let sumX = 0, sumY = 0;
          const cellIndices = [];

          for (let idx = 0; idx < totalCells; idx++) {
            if (stateArray[idx] === zone.id) {
              // Ensure child cells outside parent boundary are cleaned up
              if (parentStateArray && parentKey && zone[parentKey] !== undefined && zone[parentKey] !== -1) {
                if (parentStateArray[idx] !== zone[parentKey]) {
                  stateArray[idx] = -1;
                  continue;
                }
              }

              cellCount++;
              const cx = idx % gw;
              const cy = Math.floor(idx / gw);
              sumX += cx;
              sumY += cy;
              cellIndices.push(idx);
            }
          }

          zone.cellCount = cellCount;

          if (cellCount === 0) {
            // No territory: remove anchor so label disappears completely!
            zone.capital = null;
            if (parentKey) zone[parentKey] = -1; // Reset parent lock so it can be painted anywhere new
          } else {
            // Find most central land cell for crisp label placement
            const avgX = sumX / cellCount;
            const avgY = sumY / cellCount;
            let bestIdx = cellIndices[0];
            let bestDist = Infinity;

            for (let idx of cellIndices) {
              const cx = idx % gw;
              const cy = Math.floor(idx / gw);
              const d = (cx - avgX) * (cx - avgX) + (cy - avgY) * (cy - avgY);
              if (d < bestDist) {
                bestDist = d;
                bestIdx = idx;
              }
            }

            const bx = bestIdx % gw;
            const by = Math.floor(bestIdx / gw);
            zone.capital = {
              x: bx,
              y: by,
              px: bx * STEP + STEP / 2,
              py: by * STEP + STEP / 2
            };
          }
        }
      }

      processTier(grandZones, grandState, null, null);
      processTier(medZones, medState, grandState, 'grandId');
      processTier(smallZones, smallState, medState, 'medId');

      this.refreshZoneDropdowns();
      this.syncActiveZoneTexture();
    }

    syncActiveZoneTexture() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      if (typeof TerrainGL !== 'undefined' && TerrainGL.isInitialized) {
        const activeTier = this.currentTier || 'grand';
        TerrainGL.updateZoneTexture(worldData, activeTier, true);
        
        const opts = typeof getRenderOptions === 'function' ? getRenderOptions() : {};
        TerrainGL.render(opts);
      }
    }

    bindUI() {
      document.querySelectorAll('.zone-tier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.currentTier = btn.getAttribute('data-ztier');
          document.querySelectorAll('.zone-tier-btn').forEach(b => {
            b.style.borderColor = '#3d3448';
            b.style.background = '#1a1622';
          });
          btn.style.borderColor = '#f1c40f';
          btn.style.background = '#342918';

          const showGrandCb = document.getElementById('showGrand');
          const showMedCb = document.getElementById('showMed');
          const showSmallCb = document.getElementById('showSmall');

          if (this.currentTier === 'grand') {
            if (showGrandCb) showGrandCb.checked = true;
            if (showMedCb) showMedCb.checked = false;
            if (showSmallCb) showSmallCb.checked = false;
          } else if (this.currentTier === 'med') {
            if (showGrandCb) showGrandCb.checked = false;
            if (showMedCb) showMedCb.checked = true;
            if (showSmallCb) showSmallCb.checked = false;
          } else if (this.currentTier === 'small') {
            if (showGrandCb) showGrandCb.checked = false;
            if (showMedCb) showMedCb.checked = false;
            if (showSmallCb) showSmallCb.checked = true;
          }

          this.updateTitleDropdown();
          this.refreshZoneDropdowns();
          this.syncActiveZoneTexture();
          if (this.onRenderRequest) this.onRenderRequest(true);
        });
      });

      document.querySelectorAll('.zone-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.currentMode = btn.getAttribute('data-zmode');
          document.querySelectorAll('.zone-mode-btn').forEach(b => {
            b.style.borderColor = '#3d3448';
            b.style.background = '#1a1622';
          });
          btn.style.borderColor = '#f1c40f';
          btn.style.background = '#342918';
        });
      });

      const titleSelect = document.getElementById('zoneTitleSelect');
      if (titleSelect) {
        titleSelect.addEventListener('change', (e) => { this.currentTitle = e.target.value; });
      }

      const nameInput = document.getElementById('zoneCustomName');
      if (nameInput) {
        nameInput.addEventListener('input', (e) => { this.currentName = e.target.value; });
      }

      const randBtn = document.getElementById('zoneRandomNameBtn');
      if (randBtn) {
        randBtn.addEventListener('click', () => this.randomizeCurrentForm());
      }

      const colorInput = document.getElementById('zoneColorPicker');
      if (colorInput) {
        const onColorChange = (e) => {
          this.customColorHex = e.target.value;
          const worldData = this.getWorldData ? this.getWorldData() : null;
          if (!worldData || this.selectedZoneId === null || this.selectedZoneId === 'new') return;

          let list = [];
          if (this.currentTier === 'grand') list = worldData.grandZones;
          else if (this.currentTier === 'med') list = worldData.medZones;
          else list = worldData.smallZones;

          const targetZone = list.find(z => z.id === this.selectedZoneId);
          if (targetZone) {
            const alpha = targetZone.color?.alpha || 0.40;
            targetZone.color = createZoneColorObject(e.target.value, alpha);
            this.syncActiveZoneTexture();
            if (this.onRenderRequest) this.onRenderRequest(true);
          }
        };

        colorInput.addEventListener('input', onColorChange);
        colorInput.addEventListener('change', onColorChange);
      }

      const randColorBtn = document.getElementById('zoneRandomColorBtn');
      if (randColorBtn) {
        randColorBtn.addEventListener('click', () => {
          const newHex = this.getRandomHexColor();
          if (colorInput) {
            colorInput.value = newHex;
            colorInput.dispatchEvent(new Event('input'));
          }
        });
      }

      const activeSelect = document.getElementById('activeZoneSelect');
      if (activeSelect) {
        activeSelect.addEventListener('change', (e) => {
          if (e.target.value === 'new') {
            this.selectedZoneId = 'new';
          } else {
            this.selectedZoneId = parseInt(e.target.value);
            const worldData = this.getWorldData ? this.getWorldData() : null;
            if (worldData) {
              let list = [];
              if (this.currentTier === 'grand') list = worldData.grandZones;
              else if (this.currentTier === 'med') list = worldData.medZones;
              else list = worldData.smallZones;

              const targetZone = list.find(z => z.id === this.selectedZoneId);
              if (targetZone && targetZone.color && colorInput) {
                colorInput.value = rgbToHex(targetZone.color.fillR, targetZone.color.fillG, targetZone.color.fillB);
              }
            }
          }
        });
      }

      const createBtn = document.getElementById('zoneCreateBtn');
      if (createBtn) {
        createBtn.addEventListener('click', () => this.createNewZone());
      }
    }
  }

  return new ZoneEditorEngine();
}));
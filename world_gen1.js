
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorldGen = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // --- Priority Queue ---
  class PriorityQueue {
    constructor() { this.nodes = []; }
    push(element, priority) {
      this.nodes.push({ element, priority });
      this.bubbleUp(this.nodes.length - 1);
    }
    pop() {
      const min = this.nodes[0];
      const end = this.nodes.pop();
      if (this.nodes.length > 0) {
        this.nodes[0] = end;
        this.sinkDown(0);
      }
      return min ? min.element : null;
    }
    bubbleUp(n) {
      const element = this.nodes[n];
      while (n > 0) {
        let parentN = Math.floor((n + 1) / 2) - 1;
        let parent = this.nodes[parentN];
        if (element.priority >= parent.priority) break;
        this.nodes[parentN] = element;
        this.nodes[n] = parent;
        n = parentN;
      }
    }
    sinkDown(n) {
      const length = this.nodes.length;
      const element = this.nodes[n];
      while (true) {
        let child2N = (n + 1) * 2, child1N = child2N - 1;
        let swap = null;
        if (child1N < length) {
          if (this.nodes[child1N].priority < element.priority) swap = child1N;
        }
        if (child2N < length) {
          if (this.nodes[child2N].priority < (swap === null ? element.priority : this.nodes[child1N].priority)) swap = child2N;
        }
        if (swap === null) break;
        this.nodes[n] = this.nodes[swap];
        this.nodes[swap] = element;
        n = swap;
      }
    }
    isEmpty() { return this.nodes.length === 0; }
  }

  // --- Seeded PRNG ---
  class SeededRandom {
    constructor(seedStr) {
      let h = 2166136261 >>> 0;
      seedStr = String(seedStr || "Seed");
      for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
      }
      this.state = h >>> 0;
    }
    next() {
      let t = (this.state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      let val = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return (isNaN(val) || val < 0 || val >= 1) ? 0.5 : val;
    }
  }

  // --- Clean Perlin Noise ---
  class CleanPerlinNoise {
    constructor(rng) {
      this.p = new Uint8Array(512);
      let perm = new Uint8Array(256);
      for (let i = 0; i < 256; i++) perm[i] = i;
      for (let i = 255; i > 0; i--) {
        let j = Math.floor(rng.next() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y) {
      let h = hash & 7;
      let u = h < 4 ? x : y, v = h < 4 ? y : x;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    noise(x, y) {
      let X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      let u = this.fade(x), v = this.fade(y);
      let A = this.p[X] + Y, B = this.p[X + 1] + Y;
      return this.lerp(v,
        this.lerp(u, this.grad(this.p[A], x, y), this.grad(this.p[B], x - 1, y)),
        this.lerp(u, this.grad(this.p[A + 1], x, y - 1), this.grad(this.p[B + 1], x - 1, y - 1))
      );
    }
    fbm(x, y, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
      let total = 0, freq = 1, amp = 1, maxVal = 0;
      for (let i = 0; i < octaves; i++) {
        total += this.noise(x * freq, y * freq) * amp;
        maxVal += amp;
        amp *= persistence;
        freq *= lacunarity;
      }
      return (total / maxVal + 1) / 2;
    }
  }

  // --- Cartographic Constants & Naming Pools ---
  const HIERARCHY_TITLES = {
    empire: {
      grand: ["Holy Empire of", "Imperial Realm of", "Grand Empire of", "Celestial Empire of", "High Empire of", "Sovereign Empire of"],
      crownMed: "Imperial Crownlands of",
      crownSmall: "Imperial Seat of",
      islandMed: "Imperial Island Territory of",
      islandSmall: "Imperial Isle of",
      medium: [
        { type: "archduchy", titles: ["Archduchy of", "Grand Duchy of", "Imperial Archduchy of"], smallTypes: ["barony", "county", "lordship", "viscounty"] },
        { type: "grand_duchy", titles: ["Grand Duchy of", "High Duchy of"], smallTypes: ["barony", "county", "viscounty", "fiefdom"] },
        { type: "province", titles: ["Imperial Province of", "Crown Province of"], smallTypes: ["county", "prefecture", "district", "viscounty"] },
        { type: "electorate", titles: ["Electorate of", "Imperial Marches of"], smallTypes: ["barony", "lordship", "burgraviate", "county"] }
      ]
    },
    kingdom: {
      grand: ["Kingdom of", "Sovereign Kingdom of", "High Realm of", "Crown Realm of", "Royal Kingdom of"],
      crownMed: "Royal Domain of",
      crownSmall: "High Crown Barony of",
      islandMed: "Royal Island Duchy of",
      islandSmall: "Lordship of",
      medium: [
        { type: "duchy", titles: ["Duchy of", "High Duchy of", "Grand Duchy of"], smallTypes: ["barony", "county", "lordship", "fiefdom"] },
        { type: "principality", titles: ["Principality of", "Sovereign Principality of"], smallTypes: ["barony", "county", "seigniory", "lordship"] },
        { type: "earldom", titles: ["Earldom of", "Landgraviate of", "Margraviate of"], smallTypes: ["county", "barony", "viscounty", "shire"] },
        { type: "march", titles: ["March of", "Border March of"], smallTypes: ["barony", "lordship", "fiefdom", "castle_fief"] }
      ]
    },
    republic: {
      grand: ["Republic of", "Sovereign Republic of", "Commonwealth of", "Free Federation of", "United Republic of", "Confederated Republic of"],
      crownMed: "Federal Capital District of",
      crownSmall: "Capital Sector of",
      islandMed: "Maritime State of",
      islandSmall: "Island Canton of",
      medium: [
        { type: "state", titles: ["State of", "Free State of", "Member State of"], smallTypes: ["county", "district", "borough", "municipality", "canton"] },
        { type: "province", titles: ["Province of", "Commonwealth Province of"], smallTypes: ["district", "county", "department", "commune"] },
        { type: "canton", titles: ["Canton of", "Free Canton of"], smallTypes: ["district", "municipality", "ward", "borough"] },
        { type: "prefecture", titles: ["Prefecture of", "Autonomous Region of"], smallTypes: ["district", "commune", "prefecture_district"] }
      ]
    },
    dominion: {
      grand: ["Dominion of", "Confederation of", "Grand Alliance of", "United Dominion of", "League of"],
      crownMed: "Grand Domain of",
      crownSmall: "Chartered Seat of",
      islandMed: "Island Protectorate of",
      islandSmall: "Chartered Isle of",
      medium: [
        { type: "protectorate", titles: ["Protectorate of", "Sovereign Protectorate of"], smallTypes: ["barony", "lordship", "bailiwick", "district"] },
        { type: "territory", titles: ["Territory of", "Free Territory of", "Autonomous Territory of"], smallTypes: ["district", "canton", "settlement_ward", "county"] },
        { type: "confederate_state", titles: ["Confederate State of", "Chartered Realm of"], smallTypes: ["barony", "canton", "district", "borough"] },
        { type: "free_city_league", titles: ["Free City-State of", "Hanse of"], smallTypes: ["district", "bailiwick", "borough", "township"] }
      ]
    }
  };

  const SMALL_TITLE_FORMATS = {
    barony: ["Barony of", "Free Barony of", "High Barony of"],
    county: ["County of", "Viscounty of", "High County of", "Shire of"],
    lordship: ["Lordship of", "Seigniory of", "Fief of"],
    viscounty: ["Viscounty of", "Old Viscounty of"],
    fiefdom: ["Fiefdom of", "Castellany of"],
    burgraviate: ["Burgraviate of", "Landgrafdom of"],
    castle_fief: ["Castle Realm of", "Keep of"],
    seigniory: ["Seigniory of", "Lordship of"],
    shire: ["Shire of", "County of"],
    district: ["District of", "Prefecture District of", "Regional District of"],
    borough: ["Borough of", "Free Borough of"],
    municipality: ["Municipality of", "Canton District of"],
    canton: ["Canton of", "Sub-Canton of"],
    department: ["Department of", "Prefecture Sector of"],
    commune: ["Commune of", "Free Commune of"],
    ward: ["Ward of", "Municipal Ward of"],
    bailiwick: ["Bailiwick of", "Prefecture of"],
    township: ["Township of", "Parish of"],
    settlement_ward: ["Ward of", "District of"],
    prefecture_district: ["District of", "Sector of"]
  };

  const THEME_POOLS = {
    medieval: {
      prefixes: ["Raven", "Gold", "West", "Kings", "Oaken", "Silver", "High", "Ald", "Bram", "Black", "Red", "North", "South", "East", "Fair", "Stone", "Deep", "Wind", "Thorn", "Sun", "Ash", "Winter", "Storm", "Wolf", "Fox", "Hart", "Hawk", "Falcon", "Crow", "Knight"],
      suffixes: ["ford", "shire", "march", "bridge", "ton", "bury", "wick", "ham", "haven", "stead", "dale", "field", "wood", "hill", "cliff", "brook", "well", "cross", "watch", "holt"],
      stems: ["Ravenford", "Goldshire", "Westmarch", "Kingsbridge", "Oakenbury", "Alderton", "Brampton", "Highham", "Fairbrook", "Stonecross", "Windwatch", "Thornbury", "Sunridge", "Ashdown", "Winterdale"]
    },
    nordic: {
      prefixes: ["Frost", "Skall", "Bjorn", "Hrafn", "Tor", "Gunn", "Svein", "Einar", "Ulfr", "Vinter", "As", "Grim", "Sig", "Val", "Ragnar", "Fen", "Freyr", "Hel", "Jarl", "Kjell"],
      suffixes: ["heim", "vik", "fjord", "mark", "gard", "dal", "sund", "borg", "holm", "foss", "nes", "stadr", "berg", "lund", "vatn", "skog", "fell", "karr", "tind", "ey"],
      stems: ["Frostheim", "Skallvik", "Bjornfjord", "Hrafnmark", "Torgard", "Gunndal", "Ulfsund", "Vinterborg", "Asgardr", "Grimstadr", "Sigurdsnes", "Valhalla"]
    },
    celtic: {
      prefixes: ["Caer", "Dun", "Tair", "Bryn", "Aber", "Glen", "Llan", "Inver", "Pen", "Tre", "Kil", "Bal", "Mor", "Craig", "Rhos", "Cwm", "Ard", "Rath", "Blaen", "Strath"],
      suffixes: ["wyn", "arraidh", "loch", "moor", "mor", "cairn", "ross", "glen", "brae", "craig", "gwyn", "dwr", "llyn", "bwlch", "faen", "gell", "fynydd", "rhon", "tref", "don"],
      stems: ["Caerwyn", "Dunarraidh", "Tairloch", "Brynmoor", "Aberross", "Invercairn", "Glenmor", "Penbrae", "Llanfair", "Kilmarnock"]
    },
    slavic: {
      prefixes: ["Vol", "Drago", "Belo", "Moroz", "Krasno", "Nov", "Yaro", "Svyato", "Zve", "Gor", "Cherno", "Vladi", "Rad", "Mstis", "Bogu", "Dobro", "Zlato", "Stan", "Ostr", "Bely"],
      suffixes: ["grad", "mir", "ov", "na", "sk", "slav", "bor", "pol", "les", "yar", "gora", "dvor", "stan", "tsi", "vitsa", "chek", "rog", "litsa", "vo", "nits"],
      stems: ["Volgrad", "Dragomir", "Belov", "Morozna", "Novogor", "Krasnopol", "Yaroslav", "Svyatobor", "Chernogora", "Vladimir"]
    },
    romance: {
      prefixes: ["Mont", "Belle", "Val", "Roche", "Beau", "Clair", "Font", "Grand", "Chasteau", "Haut", "Bois", "Fleur", "Saint", "Cour", "Pont", "Champ", "Mire", "Castel", "Rive", "Vigne"],
      suffixes: ["clair", "fort", "mont", "val", "court", "lieu", "bourg", "vaux", "rive", "mare", "bois", "fleur", "pont", "champ", "font", "ombre", "pre", "puy", "giron", "chene"],
      stems: ["Montclair", "Bellefort", "Valmont", "Rochefort", "Beauvaux", "Fontclair", "Grandlieu", "Chasteaubourg", "Hautbois", "Fleurdelys"]
    },
    germanic: {
      prefixes: ["Eisen", "Falken", "Rosen", "Silber", "Adler", "Dorn", "Kron", "Wald", "Nord", "Stein", "Wolf", "Eber", "Graf", "Hoch", "Jaeger", "Koenig", "Loewen", "Rot", "Schwarz", "Sonnen"],
      suffixes: ["wald", "heim", "burg", "mark", "berg", "furt", "fels", "dorf", "brunn", "stadt", "thal", "bach", "lohe", "gart", "hausen", "bad", "horn", "kreuz", "wiese", "stein"],
      stems: ["Eisenwald", "Falkenheim", "Rosenburg", "Silbermark", "Adlerberg", "Dornfels", "Steinbrunn", "Kronfurt", "Wolfsdorf", "Eberthal"]
    },
    arcane: {
      prefixes: ["Aether", "Thaum", "Arcan", "Velth", "Astra", "Chron", "Myst", "Nexus", "Run", "Prism"],
      suffixes: ["is", "ara", "um", "eris", "spire", "pillar", "sanct", "orium", "tower", "vale"],
      stems: ["Aetheris", "Thaumara", "Arcanum", "Veltheris", "Astraspire", "Chronorium", "Mysthaven", "Nexuspoint"]
    }
  };

  const THEME_KEYS = Object.keys(THEME_POOLS);
  const HAMLET_PREFIXES = ["Little", "Lower", "Old", "West", "East", "North", "South", "Upper", "St. ", "Great"];
  const POI_DESCRIPTORS = {
    fort: ["Watchtower", "Garrison", "Bulwark", "Bastion", "Citadel", "Redoubt", "Keep", "Fortress"],
    ruins: ["Ancient Ruins", "Fallen Temple", "Lost Sanctum", "Catacombs", "Forgotten Tomb", "Barrow"],
    spire: ["Arcane Tower", "High Spire", "Wizard Observatory", "Astra Pillar", "Celestial Needle"],
    mine: ["Iron Mine", "Gold Excavation", "Deep Delve", "Quarry", "Silver Pit", "Deep Mine"],
    port: ["Harbor", "Bay Anchorage", "Wharf", "Haven Dock", "Pier Head", "Seaport", "Quay"]
  };

  const WATER_NAMES = {
    oceanPrefixes: ["Great", "Grand", "Endless", "Abyssal", "Sovereign", "Azure", "Cerulean", "Sapphire", "Cobalt", "Stormy", "Whispering", "Boundless", "Silent", "Deep", "Northern", "Southern", "Eastern", "Western", "Frozen", "Golden"],
    oceanSuffixes: ["Ocean", "Expanse", "Abyss", "Deep", "Tides", "Main", "Reach", "Waters"],
    gulfTypes: ["Gulf", "Bay", "Sound", "Strait", "Fjord", "Channel"],
    lakeTypes: ["Lake", "Loch", "Mere", "Waters"],
    riverPatterns: ["River {name}", "{name} River", "{name} Flow", "{name} Run", "{name} Waters"]
  };

  const PALETTES = {
    biomes: {
      deepOcean: [18, 50, 95], ocean: [32, 80, 135], shallows: [60, 125, 170],
      sand: [210, 195, 140], grass: [90, 140, 70], forest: [40, 100, 50],
      hills: [110, 120, 80], mountain: [115, 110, 105], snow: [240, 240, 250],
      river: "#216ba5", highway: "#7a3e1d", ruralRoad: "#4d3607", waterRoute: "#00cec9", text: "#ffffff"
    },
    parchment: {
      deepOcean: [175, 160, 130], ocean: [190, 175, 145], shallows: [205, 190, 160],
      sand: [220, 205, 175], grass: [230, 218, 188], forest: [215, 200, 170],
      hills: [200, 185, 155], mountain: [170, 155, 130], snow: [240, 230, 210],
      river: "#4a6b82", highway: "#5c3317", ruralRoad: "#8c6239", waterRoute: "#00838f", text: "#221810"
    },
    dark: {
      deepOcean: [10, 15, 25], ocean: [20, 30, 48], shallows: [35, 50, 75],
      sand: [80, 75, 65], grass: [40, 60, 45], forest: [20, 45, 30],
      hills: [60, 55, 50], mountain: [90, 85, 80], snow: [180, 185, 195],
      river: "#3a7bd5", highway: "#c08050", ruralRoad: "#8a6040", waterRoute: "#00cec9", text: "#e0e0e0"
    }
  };

  const GRAND_ZONE_COLORS = [
    { fillR: 225, fillG: 45,  fillB: 50,  alpha: 0.40, borderR: 255, borderG: 70,  borderB: 75,  nameColor: "#ff7675" },
    { fillR: 30,  fillG: 110, fillB: 235, alpha: 0.40, borderR: 70,  borderG: 160, borderB: 255, nameColor: "#74b9ff" },
    { fillR: 155, fillG: 45,  fillB: 215, alpha: 0.40, borderR: 195, borderG: 85,  borderB: 255, nameColor: "#a29bfe" },
    { fillR: 235, fillG: 140, fillB: 15,  alpha: 0.40, borderR: 255, borderG: 170, borderB: 40,  nameColor: "#ffeaa7" },
    { fillR: 225, fillG: 70,  fillB: 160, alpha: 0.40, borderR: 255, borderG: 110, borderB: 195, nameColor: "#fd79a8" },
    { fillR: 10,  fillG: 165, fillB: 220, alpha: 0.40, borderR: 45,  borderG: 210, borderB: 255, nameColor: "#81ecec" },
    { fillR: 185, fillG: 85,  fillB: 35,  alpha: 0.40, borderR: 230, borderG: 120, borderB: 65,  nameColor: "#fab1a0" },
    { fillR: 105, fillG: 50,  fillB: 190, alpha: 0.40, borderR: 145, borderG: 85,  borderB: 240, nameColor: "#d6a2e8" }
  ];

  function safeSample(arr, rng, fallback) {
    if (!Array.isArray(arr) || arr.length === 0) return fallback;
    let idx = Math.floor(rng.next() * arr.length);
    if (idx < 0 || idx >= arr.length || isNaN(idx)) idx = 0;
    return arr[idx] || fallback;
  }

  function escapeXml(unsafe) {
    return String(unsafe || "")
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function getStarPoints(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3, step = Math.PI / spikes;
    let pts = [];
    for (let i = 0; i < spikes; i++) {
      pts.push(`${(cx + Math.cos(rot) * outerRadius).toFixed(1)},${(cy + Math.sin(rot) * outerRadius).toFixed(1)}`);
      rot += step;
      pts.push(`${(cx + Math.cos(rot) * innerRadius).toFixed(1)},${(cy + Math.sin(rot) * innerRadius).toFixed(1)}`);
      rot += step;
    }
    return pts.join(" ");
  }

  function getNonGreenColor(index, alpha = 0.40) {
    let angle = (index * 137.5) % 245;
    let h = angle < 190 ? (170 + angle) : (angle - 190);
    let s = 0.85, l = 0.50;
    let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    
    let fillR = Math.round((r + m) * 255);
    let fillG = Math.round((g + m) * 255);
    let fillB = Math.round((b + m) * 255);
    
    return {
      fillR, fillG, fillB, alpha,
      borderR: Math.min(255, Math.round(fillR * 1.25 + 20)),
      borderG: Math.min(255, Math.round(fillG * 1.25 + 20)),
      borderB: Math.min(255, Math.round(fillB * 1.25 + 20)),
      nameColor: `rgb(${Math.min(255, fillR + 70)}, ${Math.min(255, fillG + 70)}, ${Math.min(255, fillB + 70)})`
    };
  }

  function generateThemedName(themeKey, rng) {
    let pool = THEME_POOLS[themeKey] || THEME_POOLS.medieval;
    if (pool.stems && pool.stems.length > 0 && rng.next() < 0.35) {
      return safeSample(pool.stems, rng, "Eldoria");
    }
    let p = safeSample(pool.prefixes, rng, "Eld");
    let s = safeSample(pool.suffixes, rng, "haven");
    return p + s;
  }

  function generateName(realmTheme, rng) {
    let effectiveTheme = (realmTheme && rng.next() < 0.90) ? realmTheme : safeSample(THEME_KEYS, rng, "medieval");
    return generateThemedName(effectiveTheme, rng);
  }

  function generateTownName(tier, realmTheme, rng) {
    let baseName = generateName(realmTheme, rng);
    if (tier === "hamlet" && rng.next() < 0.65) {
      let hp = safeSample(HAMLET_PREFIXES, rng, "Little");
      return `${hp} ${baseName}`;
    }
    return baseName;
  }

  function generatePoiName(type, realmTheme, rng) {
    let baseName = generateName(realmTheme, rng);
    let descList = POI_DESCRIPTORS[type] || ["Outpost"];
    let desc = safeSample(descList, rng, "Outpost");
    return `${baseName} ${desc}`;
  }

  function generateWaterZoneName(type, nearbyCulture, rng) {
    let baseName = rng.next() < 0.65 ? generateThemedName(nearbyCulture, rng) : safeSample(WATER_NAMES.oceanPrefixes, rng, "Azure");

    if (type === "ocean") {
      let s = safeSample(WATER_NAMES.oceanSuffixes, rng, "Ocean");
      let p = safeSample(WATER_NAMES.oceanPrefixes, rng, "Great");
      return rng.next() < 0.4 ? `${p} ${baseName} ${s}` : `${baseName} ${s}`;
    } else if (type === "gulf" || type === "bay" || type === "strait" || type === "sound" || type === "fjord") {
      let t = safeSample(WATER_NAMES.gulfTypes, rng, "Gulf");
      if (t === "Gulf" || t === "Bay" || t === "Strait" || t === "Channel") {
        return rng.next() < 0.55 ? `${t} of ${baseName}` : `${baseName} ${t}`;
      }
      return `${baseName} ${t}`;
    } else if (type === "sea") {
      return rng.next() < 0.5 ? `Sea of ${baseName}` : `${baseName} Sea`;
    } else {
      let t = safeSample(WATER_NAMES.lakeTypes, rng, "Lake");
      return rng.next() < 0.5 ? `${t} ${baseName}` : `${baseName} ${t}`;
    }
  }

  function generateRiverName(culture, rng) {
    let base = generateThemedName(culture, rng);
    let pat = safeSample(WATER_NAMES.riverPatterns, rng, "River {name}");
    return pat.replace("{name}", base);
  }

  function smoothPathChaikin(path, iterations = 2) {
    if (!path || path.length < 3) return path;
    let current = path;
    for (let it = 0; it < iterations; it++) {
      let next = [];
      next.push(current[0]);
      for (let i = 0; i < current.length - 1; i++) {
        let p0 = current[i];
        let p1 = current[i + 1];
        next.push({
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y,
          px: 0.75 * p0.px + 0.25 * p1.px,
          py: 0.75 * p0.py + 0.25 * p1.py,
          flow: p0.flow || p1.flow,
          type: p0.type || p1.type
        });
        next.push({
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y,
          px: 0.25 * p0.px + 0.75 * p1.px,
          py: 0.25 * p0.py + 0.75 * p1.py,
          flow: p1.flow || p0.flow,
          type: p1.type || p0.type
        });
      }
      next.push(current[current.length - 1]);
      current = next;
    }
    return current;
  }

  // --- Land A* Pathfinder ---
  function findSmartRoad(startNode, endNode, elevation, isWater, hasRoad, gw, gh) {
    const pScale = 4;
    const pw = Math.floor(gw / pScale);
    const ph = Math.floor(gh / pScale);

    let sx = Math.min(pw - 1, Math.max(0, Math.floor(startNode.x / pScale)));
    let sy = Math.min(ph - 1, Math.max(0, Math.floor(startNode.y / pScale)));
    let ex = Math.min(pw - 1, Math.max(0, Math.floor(endNode.x / pScale)));
    let ey = Math.min(ph - 1, Math.max(0, Math.floor(endNode.y / pScale)));

    let gScore = new Float32Array(pw * ph);
    gScore.fill(1e9);
    let cameFromX = new Int16Array(pw * ph);
    let cameFromY = new Int16Array(pw * ph);
    cameFromX.fill(-1); cameFromY.fill(-1);

    let openSet = new PriorityQueue();
    gScore[sy * pw + sx] = 0;
    openSet.push({ x: sx, y: sy }, Math.hypot(sx - ex, sy - ey));

    let found = false, iterations = 0;

    while (!openSet.isEmpty() && iterations < 18000) {
      iterations++;
      let curr = openSet.pop();

      if (curr.x === ex && curr.y === ey) {
        found = true; break;
      }

      const neighbors = [
        { x: curr.x + 1, y: curr.y, d: 1.0 }, { x: curr.x - 1, y: curr.y, d: 1.0 },
        { x: curr.x, y: curr.y + 1, d: 1.0 }, { x: curr.x, y: curr.y - 1, d: 1.0 },
        { x: curr.x + 1, y: curr.y + 1, d: 1.414 }, { x: curr.x - 1, y: curr.y - 1, d: 1.414 },
        { x: curr.x + 1, y: curr.y - 1, d: 1.414 }, { x: curr.x - 1, y: curr.y + 1, d: 1.414 }
      ];

      for (let n of neighbors) {
        if (n.x < 0 || n.x >= pw || n.y < 0 || n.y >= ph) continue;

        let gx = Math.min(gw - 1, n.x * pScale);
        let gy = Math.min(gh - 1, n.y * pScale);
        let gIdx = gy * gw + gx;

        let isBlockWater = isWater[gIdx] === 1;
        if (isBlockWater) {
          let hasLand = false;
          for (let dy = 0; dy < pScale && !hasLand; dy++) {
            for (let dx = 0; dx < pScale && !hasLand; dx++) {
              let subIdx = Math.min(gh - 1, gy + dy) * gw + Math.min(gw - 1, gx + dx);
              if (!isWater[subIdx]) hasLand = true;
            }
          }
          if (hasLand) isBlockWater = false;
        }

        let cost = 1.0 * n.d;
        if (isBlockWater) {
          cost = 10000.0 * n.d;
        } else if (elevation[gIdx] > 0.68) {
          cost = 10.0 * n.d;
        } else if (elevation[gIdx] > 0.58) {
          cost = 5.0 * n.d;
        }
        if (hasRoad[gIdx]) cost *= 0.1;

        let idx = n.y * pw + n.x;
        let currIdx = curr.y * pw + curr.x;
        let tentG = gScore[currIdx] + cost;

        if (tentG < gScore[idx]) {
          cameFromX[idx] = curr.x;
          cameFromY[idx] = curr.y;
          gScore[idx] = tentG;
          openSet.push(n, tentG + Math.hypot(n.x - ex, n.y - ey));
        }
      }
    }

    if (found) {
      let path = [];
      let cx = ex, cy = ey;
      while (cx !== -1 && cy !== -1) {
        let gx = cx * pScale;
        let gy = cy * pScale;
        path.push({ x: gx, y: gy, px: gx * 2 + 1, py: gy * 2 + 1 });
        hasRoad[gy * gw + gx] = 1;
        let idx = cy * pw + cx;
        let px = cameFromX[idx];
        let py = cameFromY[idx];
        if (px === cx && py === cy) break;
        cx = px; cy = py;
      }
      let rev = path.reverse();
      rev[0] = { x: startNode.x, y: startNode.y, px: startNode.px || (startNode.x * 2 + 1), py: startNode.py || (startNode.y * 2 + 1) };
      rev[rev.length - 1] = { x: endNode.x, y: endNode.y, px: endNode.px || (endNode.x * 2 + 1), py: endNode.py || (endNode.y * 2 + 1) };
      return rev;
    }
    return null;
  }

  // --- Nautical Sea Pathfinder ---
  function findNauticalSeaRoute(portA, portB, isWater, gw, gh) {
    const pScale = 4;
    const pw = Math.floor(gw / pScale);
    const ph = Math.floor(gh / pScale);

    function findWaterNeighbor(gx, gy) {
      let origIdx = Math.min(gh - 1, gy * pScale + 2) * gw + Math.min(gw - 1, gx * pScale + 2);
      if (isWater[origIdx]) return { x: gx, y: gy };
      for (let r = 1; r <= 4; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            let nx = gx + dx, ny = gy + dy;
            if (nx >= 0 && nx < pw && ny >= 0 && ny < ph) {
              let nIdx = Math.min(gh - 1, ny * pScale + 2) * gw + Math.min(gw - 1, nx * pScale + 2);
              if (isWater[nIdx]) return { x: nx, y: ny };
            }
          }
        }
      }
      return null;
    }

    let sPoint = findWaterNeighbor(Math.floor(portA.x / pScale), Math.floor(portA.y / pScale));
    let ePoint = findWaterNeighbor(Math.floor(portB.x / pScale), Math.floor(portB.y / pScale));

    if (!sPoint || !ePoint) return null;

    let sx = sPoint.x, sy = sPoint.y;
    let ex = ePoint.x, ey = ePoint.y;

    let gScore = new Float32Array(pw * ph);
    gScore.fill(1e9);
    let cameFromX = new Int16Array(pw * ph);
    let cameFromY = new Int16Array(pw * ph);
    cameFromX.fill(-1); cameFromY.fill(-1);

    let openSet = new PriorityQueue();
    gScore[sy * pw + sx] = 0;
    openSet.push({ x: sx, y: sy }, Math.hypot(sx - ex, sy - ey));

    let found = false, iterations = 0;

    while (!openSet.isEmpty() && iterations < 18000) {
      iterations++;
      let curr = openSet.pop();

      if (curr.x === ex && curr.y === ey) {
        found = true; break;
      }

      const neighbors = [
        { x: curr.x + 1, y: curr.y, d: 1.0 }, { x: curr.x - 1, y: curr.y, d: 1.0 },
        { x: curr.x, y: curr.y + 1, d: 1.0 }, { x: curr.x, y: curr.y - 1, d: 1.0 },
        { x: curr.x + 1, y: curr.y + 1, d: 1.414 }, { x: curr.x - 1, y: curr.y - 1, d: 1.414 },
        { x: curr.x + 1, y: curr.y - 1, d: 1.414 }, { x: curr.x - 1, y: curr.y + 1, d: 1.414 }
      ];

      for (let n of neighbors) {
        if (n.x < 0 || n.x >= pw || n.y < 0 || n.y >= ph) continue;

        let gx = Math.min(gw - 1, n.x * pScale + 2);
        let gy = Math.min(gh - 1, n.y * pScale + 2);
        let gIdx = gy * gw + gx;

        if (!isWater[gIdx]) continue;

        let cost = 1.0 * n.d;
        let idx = n.y * pw + n.x;
        let currIdx = curr.y * pw + curr.x;
        let tentG = gScore[currIdx] + cost;

        if (tentG < gScore[idx]) {
          cameFromX[idx] = curr.x;
          cameFromY[idx] = curr.y;
          gScore[idx] = tentG;
          openSet.push(n, tentG + Math.hypot(n.x - ex, n.y - ey));
        }
      }
    }

    if (found) {
      let path = [];
      let cx = ex, cy = ey;
      while (cx !== -1 && cy !== -1) {
        let gx = cx * pScale;
        let gy = cy * pScale;
        path.push({ x: gx, y: gy, px: gx * 2 + 1, py: gy * 2 + 1 });
        let idx = cy * pw + cx;
        let px = cameFromX[idx];
        let py = cameFromY[idx];
        if (px === cx && py === cy) break;
        cx = px; cy = py;
      }
      let rev = path.reverse();
      rev.unshift({ x: portA.x, y: portA.y, px: portA.px || (portA.x * 2 + 1), py: portA.py || (portA.y * 2 + 1) });
      rev.push({ x: portB.x, y: portB.y, px: portB.px || (portB.x * 2 + 1), py: portB.py || (portB.y * 2 + 1) });
      return rev;
    }
    return null;
  }

  // --- CORE WORLD GENERATION LOGIC ---
  function generateWorld(config = {}) {
    const width = config.width || 5120;
    const height = config.height || 2880;
    const STEP = config.step || 2;
    const seed = config.seed || "Aethelgard";
    const mapType = config.mapType || "continents";
    const numGrandZones = config.numGrandZones || 5;
    const targetRivers = config.targetRivers !== undefined ? config.targetRivers : 12;
    const targetPois = config.targetPois || 500;

    const gw = Math.floor(width / STEP);
    const gh = Math.floor(height / STEP);
    const totalCells = gw * gh;

    const rng = new SeededRandom(seed);
    const perlin = new CleanPerlinNoise(rng);

    const elevation = new Float32Array(totalCells);
    const isWater = new Uint8Array(totalCells);
    const flow = new Float32Array(totalCells);
    const downIdx = new Int32Array(totalCells);
    const grandState = new Int8Array(totalCells);
    const medState = new Int16Array(totalCells);
    const smallState = new Int16Array(totalCells);
    const waterZoneState = new Int16Array(totalCells).fill(-1);
    const isWaterBorder = new Uint8Array(totalCells);
    const hillshade = new Float32Array(totalCells);
    const isGrandBorder = new Uint8Array(totalCells);
    const isMedBorder = new Uint8Array(totalCells);
    const isSmallBorder = new Uint8Array(totalCells);
    const hasRoad = new Uint8Array(totalCells);

    flow.fill(1.0); downIdx.fill(-1);
    grandState.fill(-1); medState.fill(-1); smallState.fill(-1);
    hillshade.fill(1.0);

    const scale = mapType === 'archipelago' ? 0.008 : 0.0035;
    let maxRawElev = 0, seaLevel = 0.40;

    for (let y = 0; y < gh; y++) {
      let yOffset = y * gw;
      for (let x = 0; x < gw; x++) {
        let idx = yOffset + x;
        let e = perlin.fbm(x * scale, y * scale, 6, 0.5, 2.0);

        let dx = (x / gw) - 0.5, dy = (y / gh) - 0.5;
        let dist = Math.sqrt(dx * dx + dy * dy) * 2;

        if (mapType === 'continents') e -= Math.pow(dist, 1.8) * 0.45;
        else if (mapType === 'pangaea') e -= Math.pow(dist, 1.2) * 0.65;
        else if (mapType === 'archipelago') e -= Math.pow(dist, 2.6) * 0.25;

        e = Math.max(0, Math.min(1, e));
        if (e > maxRawElev) maxRawElev = e;
        elevation[idx] = e;
      }
    }

    let rawLandCells = [];
    for (let idx = 0; idx < totalCells; idx++) {
      let e = elevation[idx];
      if (e >= seaLevel && maxRawElev > seaLevel) {
        let normLand = (e - seaLevel) / (maxRawElev - seaLevel);
        e = seaLevel + Math.pow(normLand, 1.1) * 0.55;
        elevation[idx] = e;
      }
      let w = e < seaLevel ? 1 : 0;
      isWater[idx] = w;
      if (!w) rawLandCells.push(idx);
    }

    // Connected Components & Water Bodies
    const componentId = new Int16Array(totalCells).fill(-1);
    let numComponents = 0;
    const componentSizes = [];
    const componentCoasts = [];
    const componentCells = [];

    const waterBodyId = new Int16Array(totalCells).fill(-1);
    let numWaterBodies = 0;

    for (let idx = 0; idx < totalCells; idx++) {
      if (!isWater[idx] && componentId[idx] === -1) {
        let compId = numComponents++;
        componentSizes[compId] = 0;
        componentCoasts[compId] = [];
        componentCells[compId] = [];

        let queue = [idx];
        componentId[idx] = compId;
        let head = 0;

        while (head < queue.length) {
          let curr = queue[head++];
          componentSizes[compId]++;
          componentCells[compId].push(curr);
          let cx = curr % gw, cy = Math.floor(curr / gw);

          let touchesWater = false;
          if ((cx < gw - 1 && isWater[curr + 1]) ||
              (cx > 0 && isWater[curr - 1]) ||
              (cy < gh - 1 && isWater[curr + gw]) ||
              (cy > 0 && isWater[curr - gw])) {
            touchesWater = true;
          }

          if (touchesWater) {
            componentCoasts[compId].push({ idx: curr, x: cx, y: cy, flow: flow[curr] });
          }

          const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
          for (let n of neighbors) {
            if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
              let nIdx = n.y * gw + n.x;
              if (!isWater[nIdx] && componentId[nIdx] === -1) {
                componentId[nIdx] = compId;
                queue.push(nIdx);
              }
            }
          }
        }
      }

      if (isWater[idx] && waterBodyId[idx] === -1) {
        let wbId = numWaterBodies++;
        let queue = [idx];
        waterBodyId[idx] = wbId;
        let head = 0;

        while (head < queue.length) {
          let curr = queue[head++];
          let cx = curr % gw, cy = Math.floor(curr / gw);
          const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
          for (let n of neighbors) {
            if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
              let nIdx = n.y * gw + n.x;
              if (isWater[nIdx] && waterBodyId[nIdx] === -1) {
                waterBodyId[nIdx] = wbId;
                queue.push(nIdx);
              }
            }
          }
        }
      }
    }

    // Hillshading
    for (let y = 1; y < gh - 1; y++) {
      let yOffset = y * gw;
      for (let x = 1; x < gw - 1; x++) {
        let idx = yOffset + x;
        let dzdx = (elevation[idx + 1] - elevation[idx - 1]) * 2.0;
        let dzdy = (elevation[idx + gw] - elevation[idx - gw]) * 2.0;

        let lx = -0.707, ly = -0.707, lz = 0.5;
        let nx = -dzdx, ny = -dzdy, nz = 1.0;
        let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        let dot = (nx * lx + ny * ly + nz * lz) / len;

        hillshade[idx] = Math.max(0.4, Math.min(1.4, 0.6 + dot * 0.8));
      }
    }

    // Flow Accumulation
    for (let y = 0; y < gh; y++) {
      let yOffset = y * gw;
      for (let x = 0; x < gw; x++) {
        let idx = yOffset + x;
        if (isWater[idx]) continue;

        let lowestIdx = -1, lowestElev = elevation[idx];
        const neighbors = [
          { x: x + 1, y: y }, { x: x - 1, y: y }, { x: x, y: y + 1 }, { x: x, y: y - 1 },
          { x: x + 1, y: y + 1 }, { x: x - 1, y: y - 1 }, { x: x + 1, y: y - 1 }, { x: x - 1, y: y + 1 }
        ];

        for (let n of neighbors) {
          if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
            let nIdx = n.y * gw + n.x;
            if (elevation[nIdx] < lowestElev) {
              lowestElev = elevation[nIdx];
              lowestIdx = nIdx;
            }
          }
        }
        downIdx[idx] = lowestIdx;
      }
    }

    const numBuckets = 1024;
    const buckets = Array.from({ length: numBuckets }, () => []);
    for (let i = 0; i < rawLandCells.length; i++) {
      let idx = rawLandCells[i];
      let b = Math.min(numBuckets - 1, Math.max(0, Math.floor(elevation[idx] * numBuckets)));
      buckets[b].push(idx);
    }

    const landCellIndices = [];
    for (let b = numBuckets - 1; b >= 0; b--) {
      let list = buckets[b];
      for (let j = 0; j < list.length; j++) landCellIndices.push(list[j]);
    }

    for (let i = 0; i < landCellIndices.length; i++) {
      let idx = landCellIndices[i];
      let d = downIdx[idx];
      if (d !== -1) flow[d] += flow[idx];
    }

    // Rivers
    let riverMouths = [];
    for (let y = 1; y < gh - 1; y++) {
      let yOffset = y * gw;
      for (let x = 1; x < gw - 1; x++) {
        let idx = yOffset + x;
        if (!isWater[idx] && flow[idx] > 200) {
          let touchesOcean = isWater[idx + 1] || isWater[idx - 1] || isWater[idx + gw] || isWater[idx - gw];
          if (touchesOcean) riverMouths.push(idx);
        }
      }
    }

    riverMouths.sort((a, b) => flow[b] - flow[a]);
    let selectedMouths = riverMouths.slice(0, targetRivers);

    let riverPaths = [];
    for (let rIdx = 0; rIdx < selectedMouths.length; rIdx++) {
      let mouthIdx = selectedMouths[rIdx];
      let rawPath = [];
      let currIdx = mouthIdx;
      let visited = new Set();

      while (currIdx !== -1 && rawPath.length < 500) {
        if (visited.has(currIdx)) break;
        visited.add(currIdx);

        let cx = currIdx % gw, cy = Math.floor(currIdx / gw);
        rawPath.push({
          x: cx, y: cy,
          px: cx * STEP + STEP / 2,
          py: cy * STEP + STEP / 2,
          flow: flow[currIdx]
        });

        let upstream = -1, maxFlow = 0;
        const neighbors = [
          { x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 },
          { x: cx + 1, y: cy + 1 }, { x: cx - 1, y: cy - 1 }, { x: cx + 1, y: cy - 1 }, { x: cx - 1, y: cy + 1 }
        ];

        for (let n of neighbors) {
          if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
            let nIdx = n.y * gw + n.x;
            if (!isWater[nIdx] && downIdx[nIdx] === currIdx && !visited.has(nIdx)) {
              if (flow[nIdx] > maxFlow) {
                maxFlow = flow[nIdx];
                upstream = nIdx;
              }
            }
          }
        }
        currIdx = upstream;
      }

      if (rawPath.length > 5) {
        let smoothed = smoothPathChaikin(rawPath, 2);
        let midIdx = Math.floor(smoothed.length * 0.45);
        let midPt = smoothed[midIdx] || smoothed[0];
        let rName = generateRiverName("medieval", rng);

        let nextPt = smoothed[Math.min(smoothed.length - 1, midIdx + 4)] || midPt;
        let angleDeg = Math.atan2(nextPt.py - midPt.py, nextPt.px - midPt.px) * (180 / Math.PI);
        if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

        smoothed.id = `river_${rIdx}`;
        smoothed.name = rName;
        smoothed.type = "river";
        smoothed.tier = "river";
        smoothed.px = midPt.px;
        smoothed.py = midPt.py;
        smoothed.angle = angleDeg;
        smoothed.lengthLeagues = Math.round(smoothed.length * 1.6);
        riverPaths.push(smoothed);
      }
    }

    // Distance to Land & Coastal Enclosure
    const distToLand = new Int16Array(totalCells).fill(0);
    const landEnclosure = new Float32Array(totalCells).fill(0);
    let coastQueue = [];

    for (let y = 0; y < gh; y++) {
      let yOffset = y * gw;
      for (let x = 0; x < gw; x++) {
        let idx = yOffset + x;
        if (isWater[idx]) {
          let touchesLand = (x > 0 && !isWater[idx - 1]) ||
                            (x < gw - 1 && !isWater[idx + 1]) ||
                            (y > 0 && !isWater[idx - gw]) ||
                            (y < gh - 1 && !isWater[idx + gw]);
          if (touchesLand) {
            distToLand[idx] = 1;
            coastQueue.push(idx);
          }
        }
      }
    }

    let head = 0;
    while (head < coastQueue.length) {
      let curr = coastQueue[head++];
      let cx = curr % gw, cy = Math.floor(curr / gw);
      let curDist = distToLand[curr];
      const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
      for (let n of neighbors) {
        if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
          let nIdx = n.y * gw + n.x;
          if (isWater[nIdx] && distToLand[nIdx] === 0) {
            distToLand[nIdx] = curDist + 1;
            coastQueue.push(nIdx);
          }
        }
      }
    }

    const sampleRadius = 40;
    const rayDirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 0.707, dy: 0.707 }, { dx: -0.707, dy: 0.707 }, { dx: 0.707, dy: -0.707 }, { dx: -0.707, dy: -0.707 }
    ];

    for (let y = 2; y < gh - 2; y += 2) {
      let yOffset = y * gw;
      for (let x = 2; x < gw - 2; x += 2) {
        let idx = yOffset + x;
        if (!isWater[idx] || distToLand[idx] > 60) continue;

        let landHits = 0;
        for (let dir of rayDirs) {
          for (let r = 5; r <= sampleRadius; r += 5) {
            let rx = Math.floor(x + dir.dx * r);
            let ry = Math.floor(y + dir.dy * r);
            if (rx >= 0 && rx < gw && ry >= 0 && ry < gh) {
              if (!isWater[ry * gw + rx]) { landHits++; break; }
            }
          }
        }
        let val = landHits / 8.0;
        landEnclosure[idx] = val;
        landEnclosure[idx + 1] = val;
        landEnclosure[idx + gw] = val;
        landEnclosure[idx + gw + 1] = val;
      }
    }

    // Subdivide Water Zones
    let waterZones = [];
    let globalWaterZoneId = 0;
    let waterBodySizes = new Int32Array(numWaterBodies);
    for (let i = 0; i < totalCells; i++) {
      if (isWater[i] && waterBodyId[i] >= 0) waterBodySizes[waterBodyId[i]]++;
    }

    let maxOceanSize = 0, mainOceanWbId = 0;
    for (let wb = 0; wb < numWaterBodies; wb++) {
      if (waterBodySizes[wb] > maxOceanSize) {
        maxOceanSize = waterBodySizes[wb];
        mainOceanWbId = wb;
      }
    }

    for (let wbId = 0; wbId < numWaterBodies; wbId++) {
      let bodySize = waterBodySizes[wbId];
      if (bodySize < 120) continue;

      let bodyIndices = [];
      for (let i = 0; i < totalCells; i++) {
        if (waterBodyId[i] === wbId) bodyIndices.push(i);
      }

      if (wbId !== mainOceanWbId && bodySize < 10000) {
        let maxDistCell = bodyIndices[0], maxD = 0;
        for (let idx of bodyIndices) {
          waterZoneState[idx] = globalWaterZoneId;
          if (distToLand[idx] > maxD) {
            maxD = distToLand[idx];
            maxDistCell = idx;
          }
        }
        let bx = maxDistCell % gw, by = Math.floor(maxDistCell / gw);
        let zType = bodySize < 1200 ? "mere" : (bodySize < 3000 ? "loch" : "lake");
        let zName = generateWaterZoneName(zType, "medieval", rng);

        waterZones.push({
          id: globalWaterZoneId,
          name: zName,
          type: "lake",
          subType: zType.toUpperCase(),
          x: bx, y: by,
          px: bx * STEP + STEP / 2,
          py: by * STEP + STEP / 2,
          cellCount: bodySize,
          color: { fillR: 40, fillG: 120, fillB: 180, alpha: 0.15 }
        });
        globalWaterZoneId++;
      } else {
        let gulfSeeds = [];
        let oceanSeeds = [];
        let gulfCandidates = bodyIndices.filter(idx => distToLand[idx] >= 6 && distToLand[idx] <= 28 && landEnclosure[idx] >= 0.50);
        gulfCandidates.sort((a, b) => (landEnclosure[b] * 70 + distToLand[b]) - (landEnclosure[a] * 70 + distToLand[a]));

        for (let idx of gulfCandidates) {
          if (gulfSeeds.length >= 8) break;
          let gx = idx % gw, gy = Math.floor(idx / gw);
          let tooClose = gulfSeeds.some(sp => Math.hypot(sp.x - gx, sp.y - gy) < 220);
          if (!tooClose) {
            let enc = landEnclosure[idx];
            let subType = enc >= 0.65 ? "gulf" : (enc >= 0.50 ? "bay" : "strait");
            gulfSeeds.push({
              id: globalWaterZoneId + gulfSeeds.length,
              x: gx, y: gy, idx: idx,
              category: "gulf",
              subType: subType,
              isGulf: true
            });
          }
        }

        let numOceanSectors = Math.max(1, Math.min(4, Math.round(bodySize / 55000)));
        let stepGap = Math.floor(bodySize / numOceanSectors);

        for (let k = 0; k < numOceanSectors; k++) {
          let sampleIdx = bodyIndices[Math.min(bodySize - 1, k * stepGap + Math.floor(rng.next() * (stepGap * 0.4)))];
          let ox = sampleIdx % gw, oy = Math.floor(sampleIdx / gw);
          oceanSeeds.push({
            id: globalWaterZoneId + gulfSeeds.length + k,
            x: ox, y: oy, idx: sampleIdx,
            category: "ocean",
            subType: "ocean",
            isGulf: false
          });
        }

        let waterPQ = new PriorityQueue();
        for (let sp of gulfSeeds) {
          waterZoneState[sp.idx] = sp.id;
          waterPQ.push({ idx: sp.idx, zId: sp.id, isGulf: true, cost: 0 }, 0);
        }

        while (!waterPQ.isEmpty()) {
          let curr = waterPQ.pop();
          let cx = curr.idx % gw, cy = Math.floor(curr.idx / gw);
          const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
          for (let n of neighbors) {
            if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
              let nIdx = n.y * gw + n.x;
              if (isWater[nIdx] && waterBodyId[nIdx] === wbId && waterZoneState[nIdx] === -1 && landEnclosure[nIdx] >= 0.38 && distToLand[nIdx] <= 32) {
                waterZoneState[nIdx] = curr.zId;
                waterPQ.push({ idx: nIdx, zId: curr.zId, isGulf: true, cost: curr.cost + 1 }, curr.cost + 1);
              }
            }
          }
        }

        for (let sp of oceanSeeds) {
          if (waterZoneState[sp.idx] === -1) {
            waterZoneState[sp.idx] = sp.id;
            waterPQ.push({ idx: sp.idx, zId: sp.id, isGulf: false, cost: 0 }, 0);
          } else {
            let freeCell = bodyIndices.find(i => waterZoneState[i] === -1 && distToLand[i] > 30) || bodyIndices.find(i => waterZoneState[i] === -1);
            if (freeCell) {
              waterZoneState[freeCell] = sp.id;
              waterPQ.push({ idx: freeCell, zId: sp.id, isGulf: false, cost: 0 }, 0);
            }
          }
        }

        while (!waterPQ.isEmpty()) {
          let curr = waterPQ.pop();
          let cx = curr.idx % gw, cy = Math.floor(curr.idx / gw);
          const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
          for (let n of neighbors) {
            if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
              let nIdx = n.y * gw + n.x;
              if (isWater[nIdx] && waterBodyId[nIdx] === wbId && waterZoneState[nIdx] === -1) {
                waterZoneState[nIdx] = curr.zId;
                waterPQ.push({ idx: nIdx, zId: curr.zId, isGulf: false, cost: curr.cost + 1 }, curr.cost + 1);
              }
            }
          }
        }

        let allSeeds = gulfSeeds.concat(oceanSeeds);
        for (let sp of allSeeds) {
          let sectorCells = bodyIndices.filter(i => waterZoneState[i] === sp.id);
          let sCount = sectorCells.length;
          if (sCount < 180 && sp.isGulf) continue;
          if (sCount === 0) continue;

          let bestCell = sectorCells[0], bestScore = -1;
          for (let idx of sectorCells) {
            let score = distToLand[idx];
            if (score > bestScore) {
              bestScore = score;
              bestCell = idx;
            }
          }

          let bx = bestCell % gw, by = Math.floor(bestCell / gw);
          let zName = generateWaterZoneName(sp.subType, "celtic", rng);

          waterZones.push({
            id: sp.id,
            name: zName,
            type: sp.category,
            subType: sp.subType.toUpperCase(),
            x: bx, y: by,
            px: bx * STEP + STEP / 2,
            py: by * STEP + STEP / 2,
            cellCount: sCount,
            color: { fillR: 20, fillG: 90, fillB: 150, alpha: 0.12 }
          });
        }
        globalWaterZoneId += allSeeds.length;
      }
    }

    for (let y = 1; y < gh - 1; y++) {
      let yOffset = y * gw;
      for (let x = 1; x < gw - 1; x++) {
        let idx = yOffset + x;
        if (!isWater[idx]) continue;
        if (waterZoneState[idx + 1] !== -1 && waterZoneState[idx + 1] !== waterZoneState[idx]) isWaterBorder[idx] = 1;
        else if (waterZoneState[idx + gw] !== -1 && waterZoneState[idx + gw] !== waterZoneState[idx]) isWaterBorder[idx] = 1;
      }
    }

    // Urban Registry & Zone Initialization
    let globalUrbanNodes = [];
    function isUrbanSpaceClear(cx, cy, reqDist) {
      return globalUrbanNodes.every(n => Math.hypot(n.x - cx, n.y - cy) >= reqDist);
    }
    function registerUrbanNode(x, y, type, name) {
      globalUrbanNodes.push({ x, y, type, name });
    }

    let grandZones = [];
    let medZones = [];
    let smallZones = [];
    let capitals = [];
    let medSeats = [];
    let smallSeats = [];

    let marginCandidates = landCellIndices.filter(idx => {
      let e = elevation[idx], cx = idx % gw, cy = Math.floor(idx / gw);
      return e >= 0.44 && e <= 0.72 && cx > gw * 0.10 && cx < gw * 0.90 && cy > gh * 0.10 && cy < gh * 0.90;
    });
    if (marginCandidates.length === 0) marginCandidates = [...landCellIndices];
    marginCandidates.sort((a, b) => flow[b] - flow[a]);

    let grandRankKeys = ["empire", "kingdom", "republic", "dominion"];
    let minSpacing = 220;

    while (grandZones.length < numGrandZones && minSpacing >= 40) {
      for (let idx of marginCandidates) {
        if (grandZones.length >= numGrandZones) break;
        let cx = idx % gw, cy = Math.floor(idx / gw);
        let farEnough = grandZones.every(z => Math.hypot(z.capital.x - cx, z.capital.y - cy) > minSpacing);
        if (farEnough) {
          let gCulture = THEME_KEYS[(grandZones.length * 5 + Math.floor(rng.next() * 3)) % THEME_KEYS.length];
          let gName = generateThemedName(gCulture, rng);
          let rankType = grandRankKeys[grandZones.length % grandRankKeys.length];
          let titleList = HIERARCHY_TITLES[rankType].grand;
          let title = safeSample(titleList, rng, "Kingdom of");
          let fullName = `${title} ${gName}`;

          let cellObj = { id: `node_${capitals.length}`, x: cx, y: cy, px: cx * STEP + STEP / 2, py: cy * STEP + STEP / 2, elevation: elevation[idx] };
          let gZone = {
            id: grandZones.length,
            rank: rankType,
            culture: gCulture,
            name: fullName,
            shortName: gName,
            color: GRAND_ZONE_COLORS[grandZones.length % GRAND_ZONE_COLORS.length],
            capital: cellObj,
            compId: componentId[idx]
          };
          grandState[idx] = gZone.id;
          grandZones.push(gZone);
          capitals.push({ ...cellObj, type: "capital", tier: "capital", name: gName, realmId: gZone.id, compId: componentId[idx] });
          registerUrbanNode(cx, cy, "capital", gName);
        }
      }
      minSpacing -= 30;
    }

    let grandPQ = new PriorityQueue();
    for (let g of grandZones) {
      grandPQ.push({ idx: g.capital.y * gw + g.capital.x, state: g.id, cost: 0 }, 0);
    }

    while (!grandPQ.isEmpty()) {
      let curr = grandPQ.pop();
      let cx = curr.idx % gw, cy = Math.floor(curr.idx / gw);
      const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
      for (let n of neighbors) {
        if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
          let nIdx = n.y * gw + n.x;
          if (!isWater[nIdx] && grandState[nIdx] === -1) {
            grandState[nIdx] = curr.state;
            let moveCost = 1.0 + Math.pow(elevation[nIdx], 2) * 3.0;
            grandPQ.push({ idx: nIdx, state: curr.state, cost: curr.cost + moveCost }, curr.cost + moveCost);
          }
        }
      }
    }

    for (let idx of landCellIndices) {
      if (grandState[idx] === -1) {
        let cx = idx % gw, cy = Math.floor(idx / gw);
        let bestDistSq = Infinity, bestState = 0;
        for (let g = 0; g < grandZones.length; g++) {
          let dx = grandZones[g].capital.x - cx, dy = grandZones[g].capital.y - cy;
          let dSq = dx * dx + dy * dy;
          if (dSq < bestDistSq) { bestDistSq = dSq; bestState = g; }
        }
        grandState[idx] = bestState;
      }
    }

    // Medium Zones
    let globalMedId = 0;
    const maxMedAreaRatio = 0.25;
    const CAPITAL_ZONE_RADIUS = 38;

    for (let grand of grandZones) {
      let gCells = landCellIndices.filter(idx => grandState[idx] === grand.id);
      let totalGCells = gCells.length;
      if (totalGCells === 0) continue;

      let medDefs = HIERARCHY_TITLES[grand.rank].medium;
      let maxMedCap = Math.ceil(totalGCells * maxMedAreaRatio);
      let targetMedCount = Math.max(3, Math.ceil(1.0 / maxMedAreaRatio));

      let localMedList = [];
      let gCapIdx = grand.capital.y * gw + grand.capital.x;
      medState[gCapIdx] = globalMedId;
      let crownMedTitle = HIERARCHY_TITLES[grand.rank].crownMed || "Crownlands of";
      let primaryMed = {
        id: globalMedId,
        grandId: grand.id,
        name: `${crownMedTitle} ${grand.shortName}`,
        capital: grand.capital,
        medDef: medDefs[0],
        isCapitalZone: true,
        color: getNonGreenColor(globalMedId + 3, 0.40)
      };
      medZones.push(primaryMed);
      localMedList.push(primaryMed);
      globalMedId++;

      for (let compId = 0; compId < numComponents; compId++) {
        if (compId !== grand.compId && componentSizes[compId] > 200) {
          let compLand = componentCells[compId].filter(idx => grandState[idx] === grand.id);
          if (compLand.length > 150) {
            let centerIdx = compLand[Math.floor(compLand.length / 2)];
            let cx = centerIdx % gw, cy = Math.floor(centerIdx / gw);
            let islName = generateName(grand.culture, rng);
            let islTitle = HIERARCHY_TITLES[grand.rank].islandMed || "Island Province of";
            let mCellObj = { id: `node_med_${medSeats.length}`, x: cx, y: cy, px: cx * STEP + STEP / 2, py: cy * STEP + STEP / 2, elevation: elevation[centerIdx] };

            medState[centerIdx] = globalMedId;
            let islandMed = {
              id: globalMedId,
              grandId: grand.id,
              name: `${islTitle} ${islName}`,
              capital: mCellObj,
              medDef: medDefs[localMedList.length % medDefs.length],
              isCapitalZone: false,
              color: getNonGreenColor(globalMedId + 3, 0.40)
            };
            medZones.push(islandMed);
            localMedList.push(islandMed);
            medSeats.push({ ...mCellObj, type: "city", tier: "city", name: islName, realmId: grand.id, compId: compId });
            registerUrbanNode(cx, cy, "city", islName);
            globalMedId++;
          }
        }
      }

      let medDist = 90;
      gCells.sort((a, b) => flow[b] - flow[a]);

      while (localMedList.length < targetMedCount && medDist >= 35) {
        for (let idx of gCells) {
          if (localMedList.length >= targetMedCount) break;
          let cx = idx % gw, cy = Math.floor(idx / gw);

          if (Math.hypot(grand.capital.x - cx, grand.capital.y - cy) < CAPITAL_ZONE_RADIUS + 15) continue;

          if (isUrbanSpaceClear(cx, cy, medDist)) {
            let mName = generateName(grand.culture, rng);
            let subDef = medDefs[localMedList.length % medDefs.length];
            let subTitle = safeSample(subDef.titles, rng, "Duchy of");
            let mCellObj = { id: `node_med_${medSeats.length}`, x: cx, y: cy, px: cx * STEP + STEP / 2, py: cy * STEP + STEP / 2, elevation: elevation[idx] };

            medState[idx] = globalMedId;
            let newMed = {
              id: globalMedId,
              grandId: grand.id,
              name: `${subTitle} ${mName}`,
              capital: mCellObj,
              medDef: subDef,
              isCapitalZone: false,
              color: getNonGreenColor(globalMedId + 3, 0.40)
            };
            medZones.push(newMed);
            localMedList.push(newMed);
            medSeats.push({ ...mCellObj, type: "city", tier: "city", name: mName, realmId: grand.id, compId: componentId[idx] });
            registerUrbanNode(cx, cy, "city", mName);
            globalMedId++;
          }
        }
        medDist -= 15;
      }

      let medCellCounts = {};
      localMedList.forEach(m => { medCellCounts[m.id] = 1; });

      let medPQ = new PriorityQueue();
      for (let mz of localMedList) {
        medPQ.push({ idx: mz.capital.y * gw + mz.capital.x, mState: mz.id, gState: mz.grandId, cost: 0 }, 0);
      }

      const maxCapZoneCells = Math.floor(Math.PI * CAPITAL_ZONE_RADIUS * CAPITAL_ZONE_RADIUS * 0.9);

      while (!medPQ.isEmpty()) {
        let curr = medPQ.pop();
        let cx = curr.idx % gw, cy = Math.floor(curr.idx / gw);
        const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
        for (let n of neighbors) {
          if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
            let nIdx = n.y * gw + n.x;
            if (!isWater[nIdx] && grandState[nIdx] === curr.gState && medState[nIdx] === -1) {
              let isCapZone = (curr.mState === primaryMed.id);
              if (isCapZone) {
                let distToCap = Math.hypot(n.x - grand.capital.x, n.y - grand.capital.y);
                if (distToCap > CAPITAL_ZONE_RADIUS || medCellCounts[curr.mState] >= maxCapZoneCells) continue;
              } else {
                if (medCellCounts[curr.mState] >= maxMedCap * 1.25) continue;
              }

              medState[nIdx] = curr.mState;
              medCellCounts[curr.mState]++;
              let moveCost = 1.0 + Math.pow(elevation[nIdx], 2) * 3.0;
              medPQ.push({ idx: nIdx, mState: curr.mState, gState: curr.gState, cost: curr.cost + moveCost }, curr.cost + moveCost);
            }
          }
        }
      }

      let unassigned = gCells.filter(idx => medState[idx] === -1);
      let spawnAttempts = 0;
      while (unassigned.length > totalGCells * 0.05 && spawnAttempts < 6) {
        spawnAttempts++;
        unassigned.sort((a, b) => flow[b] - flow[a]);

        let spawnCandidate = unassigned.find(idx => {
          let scx = idx % gw, scy = Math.floor(idx / gw);
          return Math.hypot(grand.capital.x - scx, grand.capital.y - scy) >= CAPITAL_ZONE_RADIUS + 10 && isUrbanSpaceClear(scx, scy, 60);
        });
        if (!spawnCandidate) break;

        let scx = spawnCandidate % gw, scy = Math.floor(spawnCandidate / gw);
        let mName = generateName(grand.culture, rng);
        let subDef = medDefs[localMedList.length % medDefs.length];
        let subTitle = safeSample(subDef.titles, rng, "Duchy of");
        let mCellObj = { id: `node_med_${medSeats.length}`, x: scx, y: scy, px: scx * STEP + STEP / 2, py: scy * STEP + STEP / 2, elevation: elevation[spawnCandidate] };

        let spawnedMed = {
          id: globalMedId,
          grandId: grand.id,
          name: `${subTitle} ${mName}`,
          capital: mCellObj,
          medDef: subDef,
          isCapitalZone: false,
          color: getNonGreenColor(globalMedId + 3, 0.40)
        };
        medState[spawnCandidate] = globalMedId;
        medZones.push(spawnedMed);
        localMedList.push(spawnedMed);
        medSeats.push({ ...mCellObj, type: "city", tier: "city", name: mName, realmId: grand.id, compId: componentId[spawnCandidate] });
        registerUrbanNode(scx, scy, "city", mName);
        medCellCounts[globalMedId] = 1;

        let spawnPQ = new PriorityQueue();
        spawnPQ.push({ idx: spawnCandidate, mState: globalMedId, gState: grand.id, cost: 0 }, 0);
        globalMedId++;

        while (!spawnPQ.isEmpty()) {
          let curr = spawnPQ.pop();
          let cx = curr.idx % gw, cy = Math.floor(curr.idx / gw);
          const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
          for (let n of neighbors) {
            if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
              let nIdx = n.y * gw + n.x;
              if (!isWater[nIdx] && grandState[nIdx] === curr.gState && medState[nIdx] === -1) {
                if (medCellCounts[curr.mState] < maxMedCap * 1.25) {
                  medState[nIdx] = curr.mState;
                  medCellCounts[curr.mState]++;
                  let moveCost = 1.0 + Math.pow(elevation[nIdx], 2) * 3.0;
                  spawnPQ.push({ idx: nIdx, mState: curr.mState, gState: curr.gState, cost: curr.cost + moveCost }, curr.cost + moveCost);
                }
              }
            }
          }
        }
        unassigned = gCells.filter(idx => medState[idx] === -1);
      }

      const nonCapMeds = localMedList.filter(mz => !mz.isCapitalZone);
      const candidateMeds = nonCapMeds.length > 0 ? nonCapMeds : localMedList;

      for (let idx of gCells) {
        if (medState[idx] === -1) {
          let cx = idx % gw, cy = Math.floor(idx / gw);
          let bestDistSq = Infinity, bestMState = candidateMeds[0].id;
          for (let mz of candidateMeds) {
            let dx = mz.capital.x - cx, dy = mz.capital.y - cy;
            let dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) { bestDistSq = dSq; bestMState = mz.id; }
          }
          medState[idx] = bestMState;
        }
      }
    }

    // Small Zones
    let globalSmallId = 0;
    const maxSmallAreaRatio = 0.28;

    for (let compId = 0; compId < numComponents; compId++) {
      let cCells = componentCells[compId];
      if (cCells.length >= 20 && cCells.length <= 250) {
        let sampleIdx = cCells[0];
        let gId = grandState[sampleIdx];
        let mId = medState[sampleIdx];
        let pGrand = grandZones[gId] || grandZones[0];

        let centerIdx = cCells[Math.floor(cCells.length / 2)];
        let cx = centerIdx % gw, cy = Math.floor(centerIdx / gw);
        let islName = generateName(pGrand.culture, rng);
        let sTitle = HIERARCHY_TITLES[pGrand.rank].islandSmall || "Lordship of";
        let sCellObj = { id: `node_small_${smallSeats.length}`, x: cx, y: cy, px: cx * STEP + STEP / 2, py: cy * STEP + STEP / 2, elevation: elevation[centerIdx] };

        let islandSmall = {
          id: globalSmallId,
          medId: mId,
          name: `${sTitle} ${islName}`,
          capital: sCellObj,
          isCapitalZone: false,
          color: getNonGreenColor(globalSmallId + 11, 0.42)
        };
        smallZones.push(islandSmall);

        for (let idx of cCells) smallState[idx] = globalSmallId;
        globalSmallId++;
      }
    }

    for (let med of medZones) {
      let mCells = landCellIndices.filter(idx => medState[idx] === med.id && smallState[idx] === -1);
      let totalMCells = mCells.length;
      if (totalMCells === 0) continue;

      let parentGrand = grandZones[med.grandId];
      let allowedSmallTypes = med.medDef.smallTypes;
      let maxSmallCap = Math.ceil(totalMCells * maxSmallAreaRatio);
      let targetSmallCount = Math.max(3, Math.ceil(1.0 / maxSmallAreaRatio));

      let localSmallList = [];
      let mCapIdx = med.capital.y * gw + med.capital.x;
      smallState[mCapIdx] = globalSmallId;

      let sTitle0 = med.isCapitalZone
        ? (HIERARCHY_TITLES[parentGrand.rank].crownSmall || "Imperial Seat of")
        : safeSample(SMALL_TITLE_FORMATS[allowedSmallTypes[0]] || ["Barony of"], rng, "Barony of");
      let sName0 = med.isCapitalZone ? parentGrand.shortName : generateName(parentGrand.culture, rng);

      let primarySmall = {
        id: globalSmallId,
        medId: med.id,
        name: `${sTitle0} ${sName0}`,
        capital: med.capital,
        isCapitalZone: med.isCapitalZone,
        color: getNonGreenColor(globalSmallId + 11, 0.42)
      };
      smallZones.push(primarySmall);
      localSmallList.push(primarySmall);
      globalSmallId++;

      mCells.sort((a, b) => flow[b] - flow[a]);
      let smallDist = 50;

      if (!med.isCapitalZone) {
        while (localSmallList.length < targetSmallCount && smallDist >= 25) {
          for (let idx of mCells) {
            if (localSmallList.length >= targetSmallCount) break;
            let cx = idx % gw, cy = Math.floor(idx / gw);

            if (isUrbanSpaceClear(cx, cy, smallDist)) {
              let sName = generateName(parentGrand.culture, rng);
              let sType = allowedSmallTypes[localSmallList.length % allowedSmallTypes.length];
              let sTitleList = SMALL_TITLE_FORMATS[sType] || ["County of"];
              let sTitle = safeSample(sTitleList, rng, "County of");
              let sCellObj = { id: `node_small_${smallSeats.length}`, x: cx, y: cy, px: cx * STEP + STEP / 2, py: cy * STEP + STEP / 2, elevation: elevation[idx] };

              smallState[idx] = globalSmallId;
              let newSmall = {
                id: globalSmallId,
                medId: med.id,
                name: `${sTitle} ${sName}`,
                capital: sCellObj,
                isCapitalZone: false,
                color: getNonGreenColor(globalSmallId + 11, 0.42)
              };
              smallZones.push(newSmall);
              localSmallList.push(newSmall);
              smallSeats.push({ ...sCellObj, type: "town", tier: "town", name: sName, compId: componentId[idx] });
              registerUrbanNode(cx, cy, "town", sName);
              globalSmallId++;
            }
          }
          smallDist -= 10;
        }
      }

      let smallCellCounts = {};
      localSmallList.forEach(s => { smallCellCounts[s.id] = 1; });

      let smallPQ = new PriorityQueue();
      for (let sz of localSmallList) {
        smallPQ.push({ idx: sz.capital.y * gw + sz.capital.x, sState: sz.id, mState: sz.medId, cost: 0 }, 0);
      }

      while (!smallPQ.isEmpty()) {
        let curr = smallPQ.pop();
        let cx = curr.idx % gw, cy = Math.floor(curr.idx / gw);
        const neighbors = [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }];
        for (let n of neighbors) {
          if (n.x >= 0 && n.x < gw && n.y >= 0 && n.y < gh) {
            let nIdx = n.y * gw + n.x;
            if (!isWater[nIdx] && medState[nIdx] === curr.mState && smallState[nIdx] === -1) {
              if (smallCellCounts[curr.sState] < maxSmallCap * 1.15) {
                smallState[nIdx] = curr.sState;
                smallCellCounts[curr.sState]++;
                let moveCost = 1.0 + Math.pow(elevation[nIdx], 2) * 3.0;
                smallPQ.push({ idx: nIdx, sState: curr.sState, mState: curr.mState, cost: curr.cost + moveCost }, curr.cost + moveCost);
              }
            }
          }
        }
      }

      for (let idx of mCells) {
        if (smallState[idx] === -1) {
          let cx = idx % gw, cy = Math.floor(idx / gw);
          let bestDistSq = Infinity, bestSState = localSmallList[0].id;
          for (let sz of localSmallList) {
            let dx = sz.capital.x - cx, dy = sz.capital.y - cy;
            let dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) { bestDistSq = dSq; bestSState = sz.id; }
          }
          smallState[idx] = bestSState;
        }
      }
    }

    // Border Extraction
    for (let y = 1; y < gh - 1; y++) {
      let yOffset = y * gw;
      for (let x = 1; x < gw - 1; x++) {
        let idx = yOffset + x;
        if (isWater[idx]) continue;

        const neighborIndices = [idx + 1, idx - 1, idx + gw, idx - gw];
        for (let nIdx of neighborIndices) {
          if (!isWater[nIdx]) {
            if (grandState[nIdx] !== grandState[idx]) {
              isGrandBorder[idx] = 1;
              break;
            } else if (medState[nIdx] !== medState[idx]) {
              isMedBorder[idx] = 1;
            } else if (smallState[nIdx] !== smallState[idx] && !isMedBorder[idx]) {
              isSmallBorder[idx] = 1;
            }
          }
        }
      }
    }

    // Ports
    let placedPorts = [];
    for (let compId = 0; compId < numComponents; compId++) {
      let coasts = componentCoasts[compId];
      if (coasts && coasts.length > 0 && componentSizes[compId] >= 20) {
        coasts.sort((a, b) => b.flow - a.flow);
        let bestCoast = coasts.find(c => isUrbanSpaceClear(c.x, c.y, 40)) || coasts[0];
        let gId = grandState[bestCoast.idx];
        let rCulture = grandZones[gId]?.culture;
        let pName = generatePoiName("port", rCulture, rng);
        placedPorts.push({
          id: `node_port_${placedPorts.length}`,
          x: bestCoast.x, y: bestCoast.y,
          px: bestCoast.x * STEP + STEP / 2,
          py: bestCoast.y * STEP + STEP / 2,
          elevation: elevation[bestCoast.idx],
          type: "port",
          tier: "port",
          name: pName,
          compId: compId
        });
        registerUrbanNode(bestCoast.x, bestCoast.y, "port", pName);
      }
    }

    for (let med of medZones) {
      let mCells = landCellIndices.filter(idx => medState[idx] === med.id);
      let mCoasts = [];
      for (let idx of mCells) {
        let cx = idx % gw, cy = Math.floor(idx / gw);
        let touchesWater = (cx < gw - 1 && isWater[idx + 1]) ||
                           (cx > 0 && isWater[idx - 1]) ||
                           (cy < gh - 1 && isWater[idx + gw]) ||
                           (cy > 0 && isWater[idx - gw]);
        if (touchesWater) mCoasts.push({ idx, x: cx, y: cy, flow: flow[idx] });
      }

      if (mCoasts.length > 0) {
        let hasPortNearby = placedPorts.some(p => Math.hypot(p.x - mCoasts[0].x, p.y - mCoasts[0].y) < 140 && medState[p.y * gw + p.x] === med.id);
        if (!hasPortNearby) {
          mCoasts.sort((a, b) => b.flow - a.flow);
          let chosen = mCoasts.find(c => isUrbanSpaceClear(c.x, c.y, 60)) || mCoasts[0];
          let gId = grandState[chosen.idx];
          let rCulture = grandZones[gId]?.culture;
          let pName = generatePoiName("port", rCulture, rng);
          placedPorts.push({
            id: `node_port_${placedPorts.length}`,
            x: chosen.x, y: chosen.y,
            px: chosen.x * STEP + STEP / 2,
            py: chosen.y * STEP + STEP / 2,
            elevation: elevation[chosen.idx],
            type: "port",
            tier: "port",
            name: pName,
            compId: componentId[chosen.idx]
          });
          registerUrbanNode(chosen.x, chosen.y, "port", pName);
        }
      }
    }

    // Settlements & POIs
    let pois = [...medSeats, ...smallSeats, ...placedPorts];
    const minPoiDist = Math.max(8, Math.min(22, 220 / Math.sqrt(targetPois)));
    const cellSize = minPoiDist;
    const sCols = Math.ceil(gw / cellSize);
    const sRows = Math.ceil(gh / cellSize);
    const sGrid = new Int32Array(sCols * sRows).fill(-1);

    const registerPOI = (px, py, id) => {
      let gx = Math.floor(px / cellSize);
      let gy = Math.floor(py / cellSize);
      if (gx >= 0 && gx < sCols && gy >= 0 && gy < sRows) sGrid[gy * sCols + gx] = id;
    };

    capitals.forEach((c, idx) => registerPOI(c.x, c.y, idx));
    pois.forEach((p, idx) => registerPOI(p.x, p.y, capitals.length + idx));

    let attempts = 0;
    const maxAttempts = targetPois * 35;

    while (pois.length < targetPois && attempts < maxAttempts) {
      attempts++;
      let randIdx = safeSample(landCellIndices, rng, null);
      if (randIdx === null || isWater[randIdx]) continue;

      let cx = randIdx % gw, cy = Math.floor(randIdx / gw);
      let sgx = Math.floor(cx / cellSize);
      let sgy = Math.floor(cy / cellSize);
      let conflict = false;

      for (let dy = -1; dy <= 1 && !conflict; dy++) {
        for (let dx = -1; dx <= 1 && !conflict; dx++) {
          let nx = sgx + dx, ny = sgy + dy;
          if (nx >= 0 && nx < sCols && ny >= 0 && ny < sRows) {
            let occupant = sGrid[ny * sCols + nx];
            if (occupant !== -1) {
              let occ = occupant < capitals.length ? capitals[occupant] : pois[occupant - capitals.length];
              if (occ && Math.hypot(occ.x - cx, occ.y - cy) < minPoiDist) conflict = true;
            }
          }
        }
      }
      if (conflict) continue;

      let tier = "village";
      let e = elevation[randIdx];

      if (isGrandBorder[randIdx] && rng.next() > 0.40) tier = "fort";
      else if (e > 0.82) tier = "spire";
      else if (e > 0.70) tier = "mine";
      else if (rng.next() > 0.80) tier = "ruins";
      else {
        let roll = rng.next();
        if (roll > 0.55) tier = "village";
        else tier = "hamlet";
      }

      let gId = grandState[randIdx];
      let rCulture = grandZones[gId]?.culture;
      let name = ["town", "village", "hamlet", "city"].includes(tier) ? generateTownName(tier, rCulture, rng) : generatePoiName(tier, rCulture, rng);
      let newPoi = { id: `node_poi_${pois.length}`, x: cx, y: cy, px: cx * STEP + STEP / 2, py: cy * STEP + STEP / 2, elevation: e, type: tier, tier: tier, name, compId: componentId[randIdx] };
      registerPOI(cx, cy, capitals.length + pois.length);
      pois.push(newPoi);
    }

    // Roads & Navigation Graph
    let majorRoadPaths = [];
    let minorRoadPaths = [];
    let waterRoutePaths = [];
    const roadGraph = new Map();

    function addRoadEdgeToGraph(n1, n2, path, type = 'road') {
      if (!n1 || !n2 || !path || path.length < 2) return;
      if (!roadGraph.has(n1)) roadGraph.set(n1, []);
      if (!roadGraph.has(n2)) roadGraph.set(n2, []);

      roadGraph.get(n1).push({ target: n2, path: path, type });
      let rev = [...path].slice().reverse();
      roadGraph.get(n2).push({ target: n1, path: rev, type });
    }

    const allNodes = capitals.concat(pois);
    const componentNodesMap = new Map();

    for (let node of allNodes) {
      let gx = Math.min(gw - 1, Math.max(0, Math.floor(node.x)));
      let gy = Math.min(gh - 1, Math.max(0, Math.floor(node.y)));
      let cId = componentId[gy * gw + gx];
      if (cId === -1 && node.compId !== undefined) cId = node.compId;
      if (cId === -1) cId = 0;

      if (!componentNodesMap.has(cId)) componentNodesMap.set(cId, []);
      componentNodesMap.get(cId).push(node);
    }

    componentNodesMap.forEach((compNodes) => {
      if (compNodes.length < 2) return;

      const compMajor = compNodes.filter(p => ["capital", "city", "town", "fort", "port"].includes(p.type || p.tier));
      const compMinor = compNodes.filter(p => !["capital", "city", "town", "fort", "port"].includes(p.type || p.tier));
      const connectedNodesInComp = new Set();
      const compMajorEdges = new Set();

      if (compMajor.length >= 2) {
        for (let i = 0; i < compMajor.length; i++) {
          let m1 = compMajor[i];
          let sortedMajor = [...compMajor]
            .filter((_, idx) => idx !== i)
            .sort((a, b) => Math.hypot(a.x - m1.x, a.y - m1.y) - Math.hypot(b.x - m1.x, b.y - m1.y));

          for (let k = 0; k < Math.min(2, sortedMajor.length); k++) {
            let m2 = sortedMajor[k];
            let edgeKey = m1.x < m2.x || (m1.x === m2.x && m1.y < m2.y)
              ? `${m1.x},${m1.y}-${m2.x},${m2.y}`
              : `${m2.x},${m2.y}-${m1.x},${m1.y}`;

            if (!compMajorEdges.has(edgeKey)) {
              compMajorEdges.add(edgeKey);
              let rawPath = findSmartRoad(m1, m2, elevation, isWater, hasRoad, gw, gh);
              if (rawPath && rawPath.length > 1) {
                let smoothPath = smoothPathChaikin(rawPath, 2);
                majorRoadPaths.push(smoothPath);
                addRoadEdgeToGraph(m1, m2, smoothPath, 'road');
                connectedNodesInComp.add(m1);
                connectedNodesInComp.add(m2);
              }
            }
          }
        }
      }

      if (connectedNodesInComp.size === 0) connectedNodesInComp.add(compNodes[0]);

      for (let m of compMajor) {
        if (!connectedNodesInComp.has(m)) {
          let sortedConn = [...connectedNodesInComp].sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y));
          let target = sortedConn[0];
          if (target) {
            let rawPath = findSmartRoad(m, target, elevation, isWater, hasRoad, gw, gh);
            if (rawPath && rawPath.length > 1) {
              let smoothPath = smoothPathChaikin(rawPath, 2);
              majorRoadPaths.push(smoothPath);
              addRoadEdgeToGraph(m, target, smoothPath, 'road');
            } else {
              let direct = [
                { x: m.x, y: m.y, px: m.px || (m.x * STEP + STEP / 2), py: m.py || (m.y * STEP + STEP / 2) },
                { x: target.x, y: target.y, px: target.px || (target.x * STEP + STEP / 2), py: target.py || (target.y * STEP + STEP / 2) }
              ];
              minorRoadPaths.push(direct);
              addRoadEdgeToGraph(m, target, direct, 'road');
            }
            connectedNodesInComp.add(m);
          }
        }
      }

      let remainingMinors = [...compMinor];
      while (remainingMinors.length > 0) {
        let bestMinorIdx = -1, bestTarget = null, bestDist = Infinity;

        for (let i = 0; i < remainingMinors.length; i++) {
          let m = remainingMinors[i];
          for (let conn of connectedNodesInComp) {
            let d = Math.hypot(m.x - conn.x, m.y - conn.y);
            if (d < bestDist) {
              bestDist = d; bestMinorIdx = i; bestTarget = conn;
            }
          }
        }

        if (bestMinorIdx === -1 || !bestTarget) {
          let m = remainingMinors.shift();
          connectedNodesInComp.add(m);
          continue;
        }

        let m = remainingMinors.splice(bestMinorIdx, 1)[0];
        let rawPath = findSmartRoad(m, bestTarget, elevation, isWater, hasRoad, gw, gh);
        if (rawPath && rawPath.length > 1) {
          let smoothPath = smoothPathChaikin(rawPath, 2);
          minorRoadPaths.push(smoothPath);
          addRoadEdgeToGraph(m, bestTarget, smoothPath, 'road');
        } else {
          let direct = [
            { x: m.x, y: m.y, px: m.px || (m.x * STEP + STEP / 2), py: m.py || (m.y * STEP + STEP / 2) },
            { x: bestTarget.x, y: bestTarget.y, px: bestTarget.px || (bestTarget.x * STEP + STEP / 2), py: bestTarget.py || (bestTarget.y * STEP + STEP / 2) }
          ];
          minorRoadPaths.push(direct);
          addRoadEdgeToGraph(m, bestTarget, direct, 'road');
        }
        connectedNodesInComp.add(m);
      }
    });

    function getNodeWaterBody(node) {
      let nx = Math.floor(node.x), ny = Math.floor(node.y);
      for (let r = 1; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            let cx = nx + dx, cy = ny + dy;
            if (cx >= 0 && cx < gw && cy >= 0 && cy < gh) {
              let idx = cy * gw + cx;
              if (isWater[idx] && waterBodyId[idx] !== -1) return waterBodyId[idx];
            }
          }
        }
      }
      return -1;
    }

    if (placedPorts.length > 0) {
      let seaEdges = [];
      for (let node of allNodes) node.waterBodyId = getNodeWaterBody(node);

      for (let p1 of placedPorts) {
        let wb = p1.waterBodyId;
        if (wb === -1) continue;

        let otherPortsOnBody = placedPorts.filter(p => p !== p1 && p.waterBodyId === wb);
        let waterfrontSettlementsOnBody = allNodes.filter(n => n !== p1 && n.type !== 'port' && n.waterBodyId === wb);
        let targetCandidates = [];

        if (otherPortsOnBody.length > 0) {
          let otherComp = otherPortsOnBody.filter(p => p.compId !== p1.compId)
            .sort((a, b) => Math.hypot(a.x - p1.x, a.y - p1.y) - Math.hypot(b.x - p1.x, b.y - p1.y));
          let sameComp = otherPortsOnBody.filter(p => p.compId === p1.compId && Math.hypot(p.x - p1.x, p.y - p1.y) > 100)
            .sort((a, b) => Math.hypot(a.x - p1.x, a.y - p1.y) - Math.hypot(b.x - p1.x, b.y - p1.y));

          if (otherComp.length > 0) targetCandidates.push(otherComp[0]);
          if (otherComp.length > 1) targetCandidates.push(otherComp[1]);
          if (sameComp.length > 0) targetCandidates.push(sameComp[0]);
        } else if (waterfrontSettlementsOnBody.length > 0) {
          let reachableSettlements = [...waterfrontSettlementsOnBody]
            .sort((a, b) => Math.hypot(a.x - p1.x, a.y - p1.y) - Math.hypot(b.x - p1.x, b.y - p1.y));
          targetCandidates.push(reachableSettlements[0]);
          if (reachableSettlements.length > 1 && Math.hypot(reachableSettlements[1].x - p1.x, reachableSettlements[1].y - p1.y) < 300) {
            targetCandidates.push(reachableSettlements[1]);
          }
        }

        for (let p2 of targetCandidates) {
          if (!p2) continue;
          let exists = seaEdges.some(e => (e.start === p1 && e.end === p2) || (e.start === p2 && e.end === p1));
          if (!exists) {
            let rawWaterPath = findNauticalSeaRoute(p1, p2, isWater, gw, gh);
            if (rawWaterPath && rawWaterPath.length > 1) {
              let smoothWaterPath = smoothPathChaikin(rawWaterPath, 2);
              seaEdges.push({ start: p1, end: p2 });
              waterRoutePaths.push(smoothWaterPath);
              addRoadEdgeToGraph(p1, p2, smoothWaterPath, 'water');
            }
          }
        }
      }
    }

    // Mountain Peaks
    let mountainPeaks = [];
    const mStride = 14;
    for (let y = 10; y < gh - 10; y += mStride) {
      let yOffset = y * gw;
      for (let x = 10; x < gw - 10; x += mStride) {
        let jx = x + Math.floor((rng.next() - 0.5) * 8);
        let jy = y + Math.floor((rng.next() - 0.5) * 8);

        if (jx >= 0 && jx < gw && jy >= 0 && jy < gh) {
          let idx = jy * gw + jx;
          if (!isWater[idx] && elevation[idx] > 0.68) {
            mountainPeaks.push({
              x: jx, y: jy,
              px: jx * STEP + STEP / 2,
              py: jy * STEP + STEP / 2,
              elevation: elevation[idx]
            });
          }
        }
      }
    }
    mountainPeaks.sort((a, b) => a.y - b.y);

    return {
      gw, gh, STEP, width, height,
      elevation, isWater, flow, hillshade,
      componentId, waterBodyId,
      waterZoneState, waterZones, isWaterBorder,
      grandState, medState, smallState,
      isGrandBorder, isMedBorder, isSmallBorder, hasRoad,
      grandZones, medZones, smallZones,
      capitals, medSeats, smallSeats, pois, allNodes,
      riverPaths, mountainPeaks,
      majorRoadPaths, minorRoadPaths, waterRoutePaths,
      roadGraph
    };
  }

  // --- RENDERING ROUTINES ---
  function getResolvedRealmString(worldData, target) {
    if (!worldData || !target) return "Wilderness";
    let gx = Math.min(worldData.gw - 1, Math.max(0, Math.floor(target.x)));
    let gy = Math.min(worldData.gh - 1, Math.max(0, Math.floor(target.y)));
    let cellIdx = gy * worldData.gw + gx;
    let gRealm = worldData.grandZones[worldData.grandState[cellIdx]];
    let mRealm = worldData.medZones[worldData.medState[cellIdx]];
    let sRealm = worldData.smallZones[worldData.smallState[cellIdx]];

    let realmStr = "";
    if (sRealm) realmStr += sRealm.name;
    if (mRealm) realmStr += (realmStr ? " • " : "") + mRealm.name;
    if (gRealm) realmStr += (realmStr ? " • " : "") + gRealm.name;
    return realmStr || "Wilderness";
  }

  function drawMountainPeak(ctx, px, py, elevation, threshold = 0.68) {
    ctx.save();
    let delta = Math.max(0, elevation - threshold);
    let h = 22 + delta * 80;
    let w = 18 + delta * 60;

    ctx.beginPath();
    ctx.moveTo(px, py - h);
    ctx.lineTo(px - w / 2, py + h / 3);
    ctx.lineTo(px + w / 2, py + h / 3);
    ctx.closePath();
    ctx.fillStyle = "#7f8c8d";
    ctx.fill();
    ctx.strokeStyle = "#1a252f";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px, py - h);
    ctx.lineTo(px + w / 2, py + h / 3);
    ctx.lineTo(px, py + h / 3);
    ctx.closePath();
    ctx.fillStyle = "#4a5568";
    ctx.fill();

    if (elevation > 0.82) {
      let snowH = h * 0.35, snowW = w * 0.35;
      ctx.beginPath();
      ctx.moveTo(px, py - h);
      ctx.lineTo(px - snowW / 2, py - h + snowH);
      ctx.lineTo(px + snowW / 2, py - h + snowH);
      ctx.closePath();
      ctx.fillStyle = "#f8f9fa";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, fill, stroke) {
    let rot = Math.PI / 2 * 3, x = cx, y = cy, step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y); rot += step;
      x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y); rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawPoiShape(ctx, px, py, type) {
    ctx.save();
    ctx.translate(px, py);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000";

    if (type === "city") {
      ctx.fillStyle = "#9b59b6";
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (type === "town") {
      ctx.fillStyle = "#3498db";
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (type === "village") {
      ctx.fillStyle = "#e67e22";
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else if (type === "hamlet") {
      ctx.fillStyle = "#bdc3c7";
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (type === "port") {
      ctx.fillStyle = "#00cec9";
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
    } else if (type === "fort") {
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-3, -3, 6, 6);
    } else if (type === "spire") {
      drawStar(ctx, 0, 0, 4, 10, 4, "#9b59b6", "#000000");
    } else if (type === "mine") {
      ctx.fillStyle = "#f39c12";
      ctx.beginPath();
      ctx.moveTo(-8, -7); ctx.lineTo(8, -7); ctx.lineTo(0, 8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (type === "ruins") {
      ctx.fillStyle = "#95a5a6";
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(9, 0); ctx.lineTo(0, 9); ctx.lineTo(-9, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSmoothVectorBorders(ctx, worldData, opts = {}) {
    const { gw, gh, STEP, isWater, grandState, medState, smallState, grandZones, medZones, smallZones } = worldData;
    const showGrand = opts.showGrand ?? true;
    const showMed = opts.showMed ?? false;
    const showSmall = opts.showSmall ?? false;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (showSmall) {
      ctx.lineWidth = 1.8;
      for (let y = 0; y < gh - 1; y++) {
        let yOffset = y * gw;
        for (let x = 0; x < gw - 1; x++) {
          let idx = yOffset + x;
          let right = idx + 1;
          let bottom = idx + gw;
          if (isWater[idx] !== isWater[right] || (!isWater[idx] && smallState[idx] !== smallState[right])) {
            let sIdx = !isWater[idx] ? idx : right;
            if (smallState[sIdx] >= 0 && smallZones[smallState[sIdx]]) {
              let sc = smallZones[smallState[sIdx]].color;
              ctx.strokeStyle = `rgb(${sc.borderR}, ${sc.borderG}, ${sc.borderB})`;
              ctx.beginPath();
              ctx.moveTo((x + 1) * STEP, y * STEP);
              ctx.lineTo((x + 1) * STEP, (y + 1) * STEP);
              ctx.stroke();
            }
          }
          if (isWater[idx] !== isWater[bottom] || (!isWater[idx] && smallState[idx] !== smallState[bottom])) {
            let sIdx = !isWater[idx] ? idx : bottom;
            if (smallState[sIdx] >= 0 && smallZones[smallState[sIdx]]) {
              let sc = smallZones[smallState[sIdx]].color;
              ctx.strokeStyle = `rgb(${sc.borderR}, ${sc.borderG}, ${sc.borderB})`;
              ctx.beginPath();
              ctx.moveTo(x * STEP, (y + 1) * STEP);
              ctx.lineTo((x + 1) * STEP, (y + 1) * STEP);
              ctx.stroke();
            }
          }
        }
      }
    }

    if (showMed) {
      ctx.lineWidth = 2.6;
      for (let y = 0; y < gh - 1; y++) {
        let yOffset = y * gw;
        for (let x = 0; x < gw - 1; x++) {
          let idx = yOffset + x;
          let right = idx + 1;
          let bottom = idx + gw;
          if (isWater[idx] !== isWater[right] || (!isWater[idx] && medState[idx] !== medState[right])) {
            let mIdx = !isWater[idx] ? idx : right;
            if (medState[mIdx] >= 0 && medZones[medState[mIdx]]) {
              let mc = medZones[medState[mIdx]].color;
              ctx.strokeStyle = `rgb(${mc.borderR}, ${mc.borderG}, ${mc.borderB})`;
              ctx.beginPath();
              ctx.moveTo((x + 1) * STEP, y * STEP);
              ctx.lineTo((x + 1) * STEP, (y + 1) * STEP);
              ctx.stroke();
            }
          }
          if (isWater[idx] !== isWater[bottom] || (!isWater[idx] && medState[idx] !== medState[bottom])) {
            let mIdx = !isWater[idx] ? idx : bottom;
            if (medState[mIdx] >= 0 && medZones[medState[mIdx]]) {
              let mc = medZones[medState[mIdx]].color;
              ctx.strokeStyle = `rgb(${mc.borderR}, ${mc.borderG}, ${mc.borderB})`;
              ctx.beginPath();
              ctx.moveTo(x * STEP, (y + 1) * STEP);
              ctx.lineTo((x + 1) * STEP, (y + 1) * STEP);
              ctx.stroke();
            }
          }
        }
      }
    }

    if (showGrand) {
      ctx.lineWidth = 4.0;
      for (let y = 0; y < gh - 1; y++) {
        let yOffset = y * gw;
        for (let x = 0; x < gw - 1; x++) {
          let idx = yOffset + x;
          let right = idx + 1;
          let bottom = idx + gw;
          if (isWater[idx] !== isWater[right] || (!isWater[idx] && grandState[idx] !== grandState[right])) {
            let gIdx = !isWater[idx] ? idx : right;
            if (grandState[gIdx] >= 0 && grandZones[grandState[gIdx]]) {
              let gc = grandZones[grandState[gIdx]].color;
              ctx.strokeStyle = `rgb(${gc.borderR}, ${gc.borderG}, ${gc.borderB})`;
              ctx.beginPath();
              ctx.moveTo((x + 1) * STEP, y * STEP);
              ctx.lineTo((x + 1) * STEP, (y + 1) * STEP);
              ctx.stroke();
            }
          }
          if (isWater[idx] !== isWater[bottom] || (!isWater[idx] && grandState[idx] !== grandState[bottom])) {
            let gIdx = !isWater[idx] ? idx : bottom;
            if (grandState[gIdx] >= 0 && grandZones[grandState[gIdx]]) {
              let gc = grandZones[grandState[gIdx]].color;
              ctx.strokeStyle = `rgb(${gc.borderR}, ${gc.borderG}, ${gc.borderB})`;
              ctx.beginPath();
              ctx.moveTo(x * STEP, (y + 1) * STEP);
              ctx.lineTo((x + 1) * STEP, (y + 1) * STEP);
              ctx.stroke();
            }
          }
        }
      }
    }

    ctx.restore();
  }

  function renderTerrainToCanvas(canvas, worldData, opts = {}) {
    if (!canvas || !worldData) return;
    const ctx = canvas.getContext('2d');
    const {
      gw, gh, STEP, width, height,
      elevation, isWater, hillshade,
      grandState, medState, smallState,
      grandZones, medZones, smallZones,
      capitals, pois, riverPaths, mountainPeaks,
      majorRoadPaths, minorRoadPaths, waterRoutePaths
    } = worldData;

    const styleName = opts.style || 'biomes';
    const palette = PALETTES[styleName] || PALETTES.biomes;
    const showGrand = opts.showGrand ?? true;
    const showMed = opts.showMed ?? false;
    const showSmall = opts.showSmall ?? false;
    const showRoads = opts.showRoads ?? true;
    const showMountains = opts.showMountains ?? true;
    const showHillshade = opts.showHillshade ?? true;
    const showPois = opts.showPois ?? true;
    const showWaterZones = opts.showWaterZones ?? true;

    let activeShadingTier = "none";
    if (showGrand) activeShadingTier = "grand";
    else if (showMed) activeShadingTier = "med";
    else if (showSmall) activeShadingTier = "small";

    const imgData = ctx.createImageData(width, height);
    const buf = new ArrayBuffer(imgData.data.length);
    const buf8 = new Uint8ClampedArray(buf);
    const data32 = new Uint32Array(buf);

    const scaleX = gw / width;
    const scaleY = gh / height;

    for (let y = 0; y < height; y++) {
      const gy = y * scaleY;
      const y0 = Math.floor(gy);
      const y1 = Math.min(gh - 1, y0 + 1);
      const fy = gy - y0;
      const iFy = 1.0 - fy;
      const y0_offset = y0 * gw;
      const y1_offset = y1 * gw;
      const y_target_offset = y * width;

      for (let x = 0; x < width; x++) {
        const gx = x * scaleX;
        const x0 = Math.floor(gx);
        const x1 = Math.min(gw - 1, x0 + 1);
        const fx = gx - x0;
        const iFx = 1.0 - fx;

        const w00 = iFx * iFy;
        const w10 = fx * iFy;
        const w01 = iFx * fy;
        const w11 = fx * fy;

        const e = w00 * elevation[y0_offset + x0] +
                  w10 * elevation[y0_offset + x1] +
                  w01 * elevation[y1_offset + x0] +
                  w11 * elevation[y1_offset + x1];

        let col;
        if (e < 0.25) col = palette.deepOcean;
        else if (e < 0.38) col = palette.ocean;
        else if (e < 0.40) col = palette.shallows;
        else if (e < 0.44) col = palette.sand;
        else if (e < 0.62) col = palette.grass;
        else if (e < 0.74) col = palette.forest;
        else if (e < 0.85) col = palette.hills;
        else if (e < 0.93) col = palette.mountain;
        else col = palette.snow;

        let shade = 1.0;
        if (showHillshade) {
          shade = w00 * hillshade[y0_offset + x0] +
                  w10 * hillshade[y0_offset + x1] +
                  w01 * hillshade[y1_offset + x0] +
                  w11 * hillshade[y1_offset + x1];
        }

        let r = Math.min(255, Math.max(0, col[0] * shade));
        let g = Math.min(255, Math.max(0, col[1] * shade));
        let b = Math.min(255, Math.max(0, col[2] * shade));

        const nearestGx = fx < 0.5 ? x0 : x1;
        const nearestGy = fy < 0.5 ? y0 : y1;
        const cellIdx = nearestGy * gw + nearestGx;

        if (!isWater[cellIdx]) {
          let zColor = null;
          if (activeShadingTier === "grand" && grandState[cellIdx] >= 0) {
            zColor = grandZones[grandState[cellIdx]].color;
          } else if (activeShadingTier === "med" && medState[cellIdx] >= 0) {
            zColor = medZones[medState[cellIdx]].color;
          } else if (activeShadingTier === "small" && smallState[cellIdx] >= 0) {
            zColor = smallZones[smallState[cellIdx]].color;
          }

          if (zColor) {
            let alpha = zColor.alpha;
            let invA = 1.0 - alpha;
            r = (r * invA + zColor.fillR * alpha) | 0;
            g = (g * invA + zColor.fillG * alpha) | 0;
            b = (b * invA + zColor.fillB * alpha) | 0;
          }
        }

        data32[y_target_offset + x] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }
    imgData.data.set(buf8);
    ctx.putImageData(imgData, 0, 0);

    drawSmoothVectorBorders(ctx, worldData, { showGrand, showMed, showSmall });

    if (showWaterZones && worldData.waterZones) {
      ctx.save();
      ctx.strokeStyle = "rgba(116, 185, 255, 0.45)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      for (let y = 1; y < gh - 1; y++) {
        let yOffset = y * gw;
        for (let x = 1; x < gw - 1; x++) {
          let idx = yOffset + x;
          if (worldData.isWaterBorder[idx]) {
            ctx.strokeRect(x * STEP, y * STEP, STEP, STEP);
          }
        }
      }
      ctx.restore();
    }

    // Rivers
    ctx.strokeStyle = palette.river;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let path of riverPaths) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(path[0].px, path[0].py);

      for (let i = 1; i < path.length; i++) {
        let p = path[i];
        let w = Math.min(12, Math.max(2, Math.sqrt(p.flow) * 0.15));
        ctx.lineWidth = w;
        ctx.lineTo(p.px, p.py);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
      }
    }

    // Roads
    if (showRoads) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.strokeStyle = palette.ruralRoad || "#a67c52";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);

      for (let path of minorRoadPaths) {
        if (path && path.length > 1) {
          ctx.beginPath();
          ctx.moveTo(path[0].px, path[0].py);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].px, path[i].py);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = palette.highway || "#7a3e1d";
      ctx.lineWidth = 2.8;
      ctx.setLineDash([8, 4]);

      for (let path of majorRoadPaths) {
        if (path && path.length > 1) {
          ctx.beginPath();
          ctx.moveTo(path[0].px, path[0].py);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].px, path[i].py);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = palette.waterRoute || "#00cec9";
      ctx.lineWidth = 2.0;
      ctx.setLineDash([6, 6]);

      for (let path of waterRoutePaths) {
        if (path && path.length > 1) {
          ctx.beginPath();
          ctx.moveTo(path[0].px, path[0].py);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].px, path[i].py);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Mountains
    if (showMountains) {
      for (let peak of mountainPeaks) {
        drawMountainPeak(ctx, peak.px, peak.py, peak.elevation, 0.68);
      }
    }

    // Capitals
    for (let cap of capitals) {
      let px = cap.px || (cap.x * STEP + STEP / 2);
      let py = cap.py || (cap.y * STEP + STEP / 2);
      drawStar(ctx, px, py, 5, 14, 6, "#f1c40f", "#000000");
    }

    // Settlements & POIs
    if (showPois) {
      for (let poi of pois) {
        let px = poi.px || (poi.x * STEP + STEP / 2);
        let py = poi.py || (poi.y * STEP + STEP / 2);
        let effectiveType = poi.type || poi.tier || "village";
        drawPoiShape(ctx, px, py, effectiveType);
      }
    }
  }

  function buildSvgOverlay(worldData, opts = {}) {
    if (!worldData) return "";
    const { width, height, STEP, grandZones, medZones, smallZones, capitals, pois } = worldData;

    const showPois = opts.showPois ?? true;
    const showLegend = opts.showLegend ?? true;

    const showGrandLbl = opts.lbl_grand ?? true;
    const showMedLbl = opts.lbl_med ?? false;
    const showSmallLbl = opts.lbl_small ?? false;
    const showWaterLbl = opts.lbl_water ?? true;
    const showRiverLbl = opts.lbl_river ?? true;
    const showCapitalLbl = opts.lbl_capital ?? true;
    const showCityLbl = opts.lbl_city ?? false;
    const showTownLbl = opts.lbl_town ?? false;
    const showVillageLbl = opts.lbl_village ?? false;
    const showHamletLbl = opts.lbl_hamlet ?? false;
    const showPortLbl = opts.lbl_port ?? false;
    const showFortLbl = opts.lbl_fort ?? false;
    const showSpireLbl = opts.lbl_spire ?? false;
    const showMineLbl = opts.lbl_mine ?? false;
    const showRuinsLbl = opts.lbl_ruins ?? false;

    let out = `<style>
      .map-text { font-family: 'Cinzel', 'Palatino Linotype', 'Georgia', serif; text-anchor: middle; dominant-baseline: central; paint-order: stroke fill; stroke-linejoin: round; stroke-linecap: round; stroke-miterlimit: 2; user-select: none; }
    </style>`;

    // Zone Titles
    if (showGrandLbl) {
      out += `<g id="svg-grand-titles">`;
      for (let grand of grandZones) {
        let cx = grand.capital.x * STEP + STEP / 2;
        let cy = grand.capital.y * STEP + STEP / 2;
        let color = grand.color.nameColor || "#ffffff";
        out += `<text class="map-text" x="${cx}" y="${cy + 68}" font-size="54" font-weight="700" letter-spacing="4px" fill="${color}" stroke="#000000" stroke-width="8">${escapeXml(String(grand.name).toUpperCase())}</text>`;
      }
      out += `</g>`;
    }

    if (showMedLbl) {
      out += `<g id="svg-med-titles">`;
      for (let med of medZones) {
        let cx = med.capital.x * STEP + STEP / 2;
        let cy = med.capital.y * STEP + STEP / 2;
        let color = med.color.nameColor || "#ffeaa7";
        out += `<text class="map-text" x="${cx}" y="${cy + 52}" font-size="38" font-weight="700" font-style="italic" fill="${color}" stroke="#000000" stroke-width="6">${escapeXml(med.name)}</text>`;
      }
      out += `</g>`;
    }

    if (showSmallLbl) {
      out += `<g id="svg-small-titles">`;
      for (let small of smallZones) {
        let cx = small.capital.x * STEP + STEP / 2;
        let cy = small.capital.y * STEP + STEP / 2;
        let color = small.color.nameColor || "#ffffff";
        out += `<text class="map-text" x="${cx}" y="${cy + 40}" font-size="28" font-weight="700" fill="${color}" stroke="#000000" stroke-width="5">${escapeXml(small.name)}</text>`;
      }
      out += `</g>`;
    }

    // Water Names
    if (showWaterLbl && worldData.waterZones) {
      out += `<g id="svg-water-titles">`;
      for (let wz of worldData.waterZones) {
        if (wz.cellCount < 350) continue;
        let isOcean = wz.subType === "OCEAN";
        let isGulfOrBay = ["GULF", "BAY", "SOUND", "STRAIT", "FJORD", "CHANNEL"].includes(wz.subType);

        let fontSize = isOcean ? 50 : (isGulfOrBay ? 24 : 18);
        let letterSpacing = isOcean ? "8px" : (isGulfOrBay ? "3.5px" : "2px");
        let fillCol = isOcean ? "rgba(140, 210, 255, 0.72)" : (isGulfOrBay ? "rgba(180, 235, 255, 0.88)" : "rgba(210, 245, 255, 0.75)");
        let strokeW = isOcean ? 6.5 : 3.6;

        out += `<text class="map-text" x="${wz.px}" y="${wz.py}" font-size="${fontSize}" font-style="italic" font-weight="700" letter-spacing="${letterSpacing}" fill="${fillCol}" stroke="#030910" stroke-width="${strokeW}">${escapeXml(wz.name)}</text>`;
      }
      out += `</g>`;
    }

    // Rivers
    if (showRiverLbl && worldData.riverPaths) {
      out += `<g id="svg-river-titles">`;
      for (let river of worldData.riverPaths) {
        if (river.name && river.px !== undefined) {
          out += `<text class="map-text" x="${river.px}" y="${river.py}" transform="rotate(${river.angle || 0} ${river.px} ${river.py})" font-size="13.5" font-style="italic" font-weight="600" letter-spacing="1px" fill="#74b9ff" stroke="#060c14" stroke-width="3.2">${escapeXml(river.name)}</text>`;
        }
      }
      out += `</g>`;
    }

    // POI Labels
    out += `<g id="svg-poi-labels">`;
    if (showCapitalLbl) {
      for (let cap of capitals) {
        let px = cap.px || (cap.x * STEP + STEP / 2);
        let py = cap.py || (cap.y * STEP + STEP / 2);
        out += `<text class="map-text" x="${px}" y="${py - 22}" font-size="24" font-weight="700" fill="#ffffff" stroke="#000000" stroke-width="4.5">${escapeXml(cap.name)}</text>`;
      }
    }

    if (showPois) {
      for (let poi of pois) {
        let px = poi.px || (poi.x * STEP + STEP / 2);
        let py = poi.py || (poi.y * STEP + STEP / 2);
        let t = poi.type || poi.tier || "village";
        let shouldShow = false;
        let fontSize = 13.5, fontWeight = "500", yOffset = 13, strokeW = 2.8, fill = "#e0e0e0";

        if (t === "city") { shouldShow = showCityLbl; fontSize = 20; fontWeight = "700"; yOffset = 18; strokeW = 4.0; fill = "#ffffff"; }
        else if (t === "town") { shouldShow = showTownLbl; fontSize = 17; fontWeight = "700"; yOffset = 15; strokeW = 3.5; fill = "#ffffff"; }
        else if (t === "village") { shouldShow = showVillageLbl; fontSize = 13.5; fontWeight = "500"; yOffset = 13; strokeW = 2.8; fill = "#e0e0e0"; }
        else if (t === "hamlet") { shouldShow = showHamletLbl; fontSize = 12; fontWeight = "400"; yOffset = 11; strokeW = 2.4; fill = "#cccccc"; }
        else if (t === "port") { shouldShow = showPortLbl; fontSize = 15; fontWeight = "600"; yOffset = 14; strokeW = 3.2; fill = "#e8f4f8"; }
        else if (t === "fort") { shouldShow = showFortLbl; fontSize = 15; fontWeight = "600"; yOffset = 14; strokeW = 3.2; fill = "#e8f4f8"; }
        else if (t === "spire") { shouldShow = showSpireLbl; fontSize = 13; fontWeight = "500"; yOffset = 12; strokeW = 2.6; fill = "#dcdde1"; }
        else if (t === "mine") { shouldShow = showMineLbl; fontSize = 12.5; fontWeight = "500"; yOffset = 12; strokeW = 2.5; fill = "#f5cd79"; }
        else if (t === "ruins") { shouldShow = showRuinsLbl; fontSize = 12; fontWeight = "400"; yOffset = 11; strokeW = 2.4; fill = "#bdc581"; }

        if (shouldShow) {
          out += `<text class="map-text" x="${px}" y="${py - yOffset}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" stroke="#000000" stroke-width="${strokeW}">${escapeXml(poi.name)}</text>`;
        }
      }
    }
    out += `</g>`;

    // Map Legend
    if (showLegend) {
      let lx = 50, ly = height - 810, lw = 620, lh = 760;
      out += `<g id="svg-legend">`;
      out += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="10" fill="rgba(12, 12, 16, 0.94)" stroke="rgba(212, 175, 55, 0.85)" stroke-width="3.5"/>`;
      out += `<text x="${lx + 30}" y="${ly + 46}" font-family="Cinzel, Georgia, serif" font-size="26" font-weight="700" fill="#d4af37" text-anchor="start" dominant-baseline="central">MAP LEGEND &amp; HIERARCHY</text>`;
      out += `<line x1="${lx + 30}" y1="${ly + 66}" x2="${lx + lw - 30}" y2="${ly + 66}" stroke="rgba(212, 175, 55, 0.4)" stroke-width="1.5"/>`;

      let styleName = opts.style || 'biomes';
      let palette = PALETTES[styleName] || PALETTES.biomes;

      let entries = [
        { type: "capital_icon", text: "Capital City (Grand Realm Seat)" },
        { type: "city_icon", text: "Major City (Duchy / State Seat)" },
        { type: "town_icon", text: "Walled Town (Barony Seat)" },
        { type: "village_icon", text: "Village (Rural Center)" },
        { type: "hamlet_icon", text: "Hamlet (Crossroads)" },
        { type: "port_icon", text: "Coastal Port / Naval Harbor" },
        { type: "fort_icon", text: "Border Citadel / Fortress" },
        { type: "spire_icon", text: "Arcane Spire / Wizard Tower" },
        { type: "mine_icon", text: "Mine / Quarry Excavation" },
        { type: "ruins_icon", text: "Ancient Ruins / Sanctum" },
        { type: "mountain_icon", text: "Mountain Peak / Range" },
        { type: "highway_line", text: "Major Trade Highway" },
        { type: "road_line", text: "Minor Rural Road / Byway" },
        { type: "water_line", text: "Water Route (Port-to-Port)" },
        { type: "border_line", text: "Grand Realm Sovereign Border" }
      ];

      let startY = ly + 96;
      let stepY = 38;
      for (let i = 0; i < entries.length; i++) {
        let ey = startY + i * stepY;
        let e = entries[i];
        let iconX = lx + 45;

        if (e.type === "capital_icon") {
          let pts = getStarPoints(iconX, ey, 5, 12, 5.5);
          out += `<polygon points="${pts}" fill="#f1c40f" stroke="#000000" stroke-width="1.5"/>`;
        } else if (e.type === "city_icon") {
          out += `<circle cx="${iconX}" cy="${ey}" r="11" fill="#9b59b6" stroke="#000000" stroke-width="2"/><circle cx="${iconX}" cy="${ey}" r="5" fill="#ffffff"/>`;
        } else if (e.type === "town_icon") {
          out += `<circle cx="${iconX}" cy="${ey}" r="9" fill="#3498db" stroke="#000000" stroke-width="2"/><circle cx="${iconX}" cy="${ey}" r="3.5" fill="#ffffff"/>`;
        } else if (e.type === "village_icon") {
          out += `<circle cx="${iconX}" cy="${ey}" r="7" fill="#e67e22" stroke="#000000" stroke-width="2"/>`;
        } else if (e.type === "hamlet_icon") {
          out += `<circle cx="${iconX}" cy="${ey}" r="3.5" fill="#bdc3c7" stroke="#000000" stroke-width="1.8"/>`;
        } else if (e.type === "port_icon") {
          out += `<circle cx="${iconX}" cy="${ey}" r="10" fill="#00cec9" stroke="#000000" stroke-width="2"/><path d="M ${iconX - 5} ${ey} L ${iconX + 5} ${ey} M ${iconX} ${ey - 5} L ${iconX} ${ey + 5}" stroke="#ffffff" stroke-width="2"/>`;
        } else if (e.type === "fort_icon") {
          out += `<rect x="${iconX - 9}" y="${ey - 9}" width="18" height="18" fill="#e74c3c" stroke="#000000" stroke-width="2"/><rect x="${iconX - 3.5}" y="${ey - 3.5}" width="7" height="7" fill="#ffffff"/>`;
        } else if (e.type === "spire_icon") {
          let pts = getStarPoints(iconX, ey, 4, 12, 4.5);
          out += `<polygon points="${pts}" fill="#9b59b6" stroke="#000000" stroke-width="1.8"/>`;
        } else if (e.type === "mine_icon") {
          out += `<polygon points="${iconX - 10},${ey - 8} ${iconX + 10},${ey - 8} ${iconX},${ey + 10}" fill="#f39c12" stroke="#000000" stroke-width="2"/>`;
        } else if (e.type === "ruins_icon") {
          out += `<polygon points="${iconX},${ey - 11} ${iconX + 11},${ey} ${iconX},${ey + 11} ${iconX - 11},${ey}" fill="#95a5a6" stroke="#000000" stroke-width="2"/>`;
        } else if (e.type === "mountain_icon") {
          out += `<polygon points="${iconX},${ey - 12} ${iconX - 12},${ey + 9} ${iconX + 12},${ey + 9}" fill="#7f8c8d" stroke="#1a252f" stroke-width="1.5"/><polygon points="${iconX},${ey - 12} ${iconX + 12},${ey + 9} ${iconX},${ey + 9}" fill="#4a5568"/>`;
        } else if (e.type === "highway_line") {
          out += `<line x1="${iconX - 18}" y1="${ey}" x2="${iconX + 18}" y2="${ey}" stroke="${palette.highway || '#7a3e1d'}" stroke-width="3.5" stroke-dasharray="10,5"/>`;
        } else if (e.type === "road_line") {
          out += `<line x1="${iconX - 18}" y1="${ey}" x2="${iconX + 18}" y2="${ey}" stroke="${palette.ruralRoad || '#a67c52'}" stroke-width="2" stroke-dasharray="5,5"/>`;
        } else if (e.type === "water_line") {
          out += `<line x1="${iconX - 18}" y1="${ey}" x2="${iconX + 18}" y2="${ey}" stroke="${palette.waterRoute || '#00cec9'}" stroke-width="2.5" stroke-dasharray="8,8"/>`;
        } else if (e.type === "border_line") {
          out += `<line x1="${iconX - 18}" y1="${ey}" x2="${iconX + 18}" y2="${ey}" stroke="#e74c3c" stroke-width="4.5"/>`;
        }

        out += `<text x="${lx + 76}" y="${ey + 1}" font-family="Georgia, serif" font-size="18" fill="#e8e8e8" text-anchor="start" dominant-baseline="central">${e.text}</text>`;
      }

      let scY = startY + entries.length * stepY + 12;
      out += `<line x1="${lx + 30}" y1="${scY + 15}" x2="${lx + 180}" y2="${scY + 15}" stroke="#d4af37" stroke-width="3.5"/>`;
      out += `<line x1="${lx + 30}" y1="${scY + 7}" x2="${lx + 30}" y2="${scY + 23}" stroke="#d4af37" stroke-width="3.5"/>`;
      out += `<line x1="${lx + 180}" y1="${scY + 7}" x2="${lx + 180}" y2="${scY + 23}" stroke="#d4af37" stroke-width="3.5"/>`;
      out += `<text x="${lx + 30}" y="${scY}" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#d4af37" text-anchor="start">100 LEAGUES</text>`;

      out += `</g>`;
    }

    return out;
  }

  function exportSvgString(worldData, canvas, opts = {}) {
    if (!worldData || !canvas) return "";
    const { width, height } = worldData;
    const rasterTerrainUrl = canvas.toDataURL("image/png");

    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
    svg += `  <image width="${width}" height="${height}" xlink:href="${rasterTerrainUrl}"/>\n`;
    svg += buildSvgOverlay(worldData, opts);
    svg += `\n</svg>`;
    return svg;
  }

  // --- PUBLIC API EXPORT ---
  return {
    PriorityQueue,
    SeededRandom,
    CleanPerlinNoise,
    PALETTES,
    GRAND_ZONE_COLORS,
    THEME_POOLS,
    HIERARCHY_TITLES,
    SMALL_TITLE_FORMATS,
    WATER_NAMES,
    safeSample,
    escapeXml,
    getStarPoints,
    getNonGreenColor,
    smoothPathChaikin,
    findSmartRoad,
    findNauticalSeaRoute,
    getResolvedRealmString,
    generateWorld,
    renderTerrainToCanvas,
    buildSvgOverlay,
    exportSvgString
  };
}));

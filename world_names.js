/**
 * ============================================================================
 * WORLD_NAMES.JS - Cartographic Lexicon & Thematic Naming Dictionaries
 * ============================================================================
 * Contains all culture stems, realm titles, POI descriptors, and naming pools.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorldNames = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

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

  return {
    HIERARCHY_TITLES,
    SMALL_TITLE_FORMATS,
    THEME_POOLS,
    THEME_KEYS: Object.keys(THEME_POOLS),
    HAMLET_PREFIXES,
    POI_DESCRIPTORS,
    WATER_NAMES
  };
}));
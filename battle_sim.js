/**
 * Tactical Battle Simulator Core Engine & UI Controller
 * Shared library for tactical combat calculations and IndexedDB integration.
 */

// =========================================================
// STALEMATE BREAKER & BALANCE CONFIGURATION
// =========================================================
const BALANCING_CONFIG = {
    FATIGUE_START_TURN: 12,      // Turn when healing reduction starts
    HEAL_DECAY_PER_TURN: 0.08,   // 8% decrease in heal effectiveness per turn
    MIN_HEAL_EFFICIENCY: 0.0,    // Floor: 0%

    ARMOR_DECAY_START_TURN: 10,  // Turn when armor decay starts
    ARMOR_DECAY_PER_TURN: 0.02,  // 2% reduction in armor per turn
    MIN_ARMOR_EFFICIENCY: 0.20,  // Floor: 20%

    BASE_DAMAGE_PENETRATION_PCT: 0.15 // 15% minimum unmitigated penetration
};

function getHealEfficiency(turn) {
    if (turn < BALANCING_CONFIG.FATIGUE_START_TURN) return 1.0;
    let turnsPassed = turn - BALANCING_CONFIG.FATIGUE_START_TURN;
    let efficiency = 1.0 - (turnsPassed * BALANCING_CONFIG.HEAL_DECAY_PER_TURN);
    return Math.max(BALANCING_CONFIG.MIN_HEAL_EFFICIENCY, efficiency);
}

function getArmorEfficiency(turn) {
    if (turn < BALANCING_CONFIG.ARMOR_DECAY_START_TURN) return 1.0;
    let turnsPassed = turn - BALANCING_CONFIG.ARMOR_DECAY_START_TURN;
    let efficiency = 1.0 - (turnsPassed * BALANCING_CONFIG.ARMOR_DECAY_PER_TURN);
    return Math.max(BALANCING_CONFIG.MIN_ARMOR_EFFICIENCY, efficiency);
}

// Tier Lookup Map
const tierRankMap = { "EX": 9, "SSS": 8, "SS": 7, "S": 6, "A": 5, "B": 4, "C": 3, "D": 2, "E": 1, "F": 0 };

function getTierInfo(potentialStr) {
    const match = String(potentialStr).match(/\((EX|SSS|SS|S|A|B|C|D|E|F)\)/i);
    const letter = match ? match[1].toUpperCase() : "F";
    const rank = tierRankMap[letter] !== undefined ? tierRankMap[letter] : 0;
    return { letter, rank };
}

// Combat Class Mapping
const combatClassMapping = {
    Juggernaut: { coreStat: "strength", subStat: "constitution", damageType: "pure physical" },
    BladeDancer: { coreStat: "strength", subStat: "dexterity", damageType: "hybrid A" },
    Chieftain: { coreStat: "strength", subStat: "intelligence", damageType: "hybrid A" },
    IronWill: { coreStat: "strength", subStat: "resolve", damageType: "pure physical" },
    Berserker: { coreStat: "strength", subStat: "perception", damageType: "pure physical" },
    Titan: { coreStat: "constitution", subStat: "strength", damageType: "pure physical" },
    StalwartDefender: { coreStat: "constitution", subStat: "resolve", damageType: "pure physical" },
    Mercenery: { coreStat: "constitution", subStat: "dexterity", damageType: "pure physical" },
    Bladecaster: { coreStat: "dexterity", subStat: "intelligence", damageType: "hybrid A" },
    MartialArtist: { coreStat: "dexterity", subStat: "resolve", damageType: "hybrid A" },
    Sentinel: { coreStat: "constitution", subStat: "perception", damageType: "pure physical" },
    SavageSwifter: { coreStat: "dexterity", subStat: "strength", damageType: "pure physical" },
    Swiftblade: { coreStat: "dexterity", subStat: "constitution", damageType: "pure physical" },
    AuraWarrior: { coreStat: "resolve", subStat: "strength", damageType: "hybrid A" },
    Assassin: { coreStat: "dexterity", subStat: "perception", damageType: "hybrid A" },
    Tactician: { coreStat: "intelligence", subStat: "strength", damageType: "hybrid A" },
    Colossus: { coreStat: "strength", subStat: "strength", damageType: "pure physical" },
    FleshFortress: { coreStat: "constitution", subStat: "constitution", damageType: "pure physical" },
    Tempest: { coreStat: "dexterity", subStat: "dexterity", damageType: "pure physical" },
    IronAura: { coreStat: "resolve", subStat: "constitution", damageType: "hybrid A" },
    PhantomBlade: { coreStat: "resolve", subStat: "dexterity", damageType: "hybrid B" },
    Deadeye: { coreStat: "perception", subStat: "dexterity", damageType: "pure physical" },
    Scout: { coreStat: "perception", subStat: "resolve", damageType: "pure physical" },
    Trickshot: { coreStat: "perception", subStat: "intelligence", damageType: "hybrid A" },
    Powershot: { coreStat: "perception", subStat: "strength", damageType: "pure physical" },
    Vanguard: { coreStat: "perception", subStat: "constitution", damageType: "pure physical" },
    ArcaneArcher: { coreStat: "intelligence", subStat: "dexterity", damageType: "hybrid B" },
    GodEye: { coreStat: "perception", subStat: "perception", damageType: "pure physical" },
    Sorcerer: { coreStat: "resolve", subStat: "intelligence", damageType: "pure magic" },
    Spiritist: { coreStat: "resolve", subStat: "perception", damageType: "pure magic" },
    Mage: { coreStat: "intelligence", subStat: "resolve", damageType: "pure magic" },
    Diviner: { coreStat: "intelligence", subStat: "perception", damageType: "pure magic" },
    ManaWeaver: { coreStat: "intelligence", subStat: "intelligence", damageType: "pure magic" },
    MentalFortress: { coreStat: "resolve", subStat: "resolve", damageType: "hybrid B" },
    BattlePriest: { coreStat: "constitution", subStat: "intelligence", damageType: "hybrid B" },
    Sage: { coreStat: "intelligence", subStat: "constitution", damageType: "hybrid B" },
};

// Class-Specific Technique Specifications
const classTechniqueSpecs = {
    Juggernaut: { name: "Earthshaker Slam", cooldown: 4, type: "tank_strike", dmgMult: 1.5, armorPen: 0.5, physResBuff: 1.3, buffTurns: 2 },
    Titan: { name: "Colossal Impact", cooldown: 4, type: "tank_strike", dmgMult: 1.6, armorPen: 0.5, physResBuff: 1.3, buffTurns: 2 },
    Colossus: { name: "Titanic Might", cooldown: 4, type: "tank_strike", dmgMult: 1.6, armorPen: 0.4, physResBuff: 1.4, buffTurns: 2 },
    IronWill: { name: "Unbreakable Resolve", cooldown: 4, type: "tank_strike", dmgMult: 1.4, armorPen: 0.3, physResBuff: 1.5, buffTurns: 2 },

    Berserker: { name: "Frenzied Onslaught", cooldown: 4, type: "berserk_strike", dmgMult: 1.8, critMultBonus: 0.35 },

    BladeDancer: { name: "Silver Mirage Flurry", cooldown: 4, type: "extra_hits", bonusHits: 2, dmgMult: 1.2 },
    Swiftblade: { name: "Flashstep Slash", cooldown: 4, type: "extra_hits", bonusHits: 2, dmgMult: 1.15 },
    Tempest: { name: "Cyclone Fury", cooldown: 4, type: "extra_hits", bonusHits: 2, dmgMult: 1.25 },
    SavageSwifter: { name: "Predatory Pounce", cooldown: 3, type: "extra_hits", bonusHits: 1, dmgMult: 1.25 },

    Assassin: { name: "Fatal Shadowstrike", cooldown: 6, type: "assassin_strike", dmgMult: 2.0, ignoreDefenses: true, critChanceBonus: 30 },
    PhantomBlade: { name: "Ethereal Execution", cooldown: 5, type: "assassin_strike", dmgMult: 1.9, ignoreDefenses: true, critChanceBonus: 25 },

    StalwartDefender: { name: "Unyielding Bastion", cooldown: 5, type: "ultimate_def", resBoost: 2.0, healPct: 0.15 },
    FleshFortress: { name: "Ironclad Citadel", cooldown: 5, type: "ultimate_def", resBoost: 2.2, healPct: 0.25 },
    Sentinel: { name: "Watchful Guardian", cooldown: 5, type: "ultimate_def", resBoost: 1.8, healPct: 0.20 },

    Sorcerer: { name: "Arcane Cataclysm", cooldown: 4, type: "magic_burst", dmgMult: 1.7, magPen: 0.5, mpRegen: 20 },
    ManaWeaver: { name: "Singularity Burst", cooldown: 4, type: "magic_burst", dmgMult: 1.8, magPen: 0.5, mpRegen: 25 },
    Mage: { name: "Eldritch Overload", cooldown: 4, type: "magic_burst", dmgMult: 1.6, magPen: 0.4, mpRegen: 15 },

    Spiritist: { name: "Soul Siphon", cooldown: 4, type: "utility_magic", dmgMult: 1.4, mpDrain: 20, healPct: 0.10 },
    Diviner: { name: "Prophetic Foresight", cooldown: 4, type: "utility_magic", dmgMult: 1.3, evadeBuff: 25, buffTurns: 2 },
    Sage: { name: "Runic Reflection", cooldown: 4, type: "utility_magic", dmgMult: 1.4, healPct: 0.15 },
    MentalFortress: { name: "Psychic Barrier", cooldown: 4, type: "ultimate_def", resBoost: 1.8, healPct: 0.10 },

    Deadeye: { name: "Heartseeker Shot", cooldown: 4, type: "ranged_precision", dmgMult: 1.7, guaranteeCrit: true, ignoreEvasion: true },
    ArcaneArcher: { name: "Enchanted Volley", cooldown: 4, type: "ranged_precision", dmgMult: 1.6, guaranteeCrit: true, ignoreEvasion: true },
    Powershot: { name: "Titanpiercer Shot", cooldown: 4, type: "ranged_precision", dmgMult: 1.8, guaranteeCrit: true, armorPen: 0.5 },
    Scout: { name: "Sniper Vigilance", cooldown: 3, type: "ranged_precision", dmgMult: 1.5, guaranteeCrit: true, ignoreEvasion: true },
    Trickshot: { name: "Ricochet Ambush", cooldown: 4, type: "ranged_precision", dmgMult: 1.6, guaranteeCrit: true, ignoreEvasion: true },
    Vanguard: { name: "Aegis Barrage", cooldown: 4, type: "tank_strike", dmgMult: 1.4, physResBuff: 1.3, buffTurns: 2 },
    GodEye: { name: "Clairvoyant Strike", cooldown: 4, type: "ranged_precision", dmgMult: 1.8, guaranteeCrit: true, ignoreEvasion: true },

    BattlePriest: { name: "Divine Retribution", cooldown: 4, type: "hybrid_drain", dmgMult: 1.6, lifestealPct: 0.5 },
    AuraWarrior: { name: "Aura Cleave", cooldown: 4, type: "hybrid_drain", dmgMult: 1.5, lifestealPct: 0.4 },
    IronAura: { name: "Aegis Smite", cooldown: 4, type: "hybrid_drain", dmgMult: 1.4, lifestealPct: 0.4, physResBuff: 1.3, buffTurns: 2 },

    Tactician: { name: "Strategic Gambit", cooldown: 3, type: "tactical", dmgMult: 1.4, evadeBuff: 15, critBuff: 15, buffTurns: 2 },
    Chieftain: { name: "Runehammer Wrath", cooldown: 4, type: "tactical", dmgMult: 1.5, physResBuff: 1.2, buffTurns: 2 },
    MartialArtist: { name: "Dragon Palm", cooldown: 3, type: "tactical", dmgMult: 1.4, evadeBuff: 20, buffTurns: 2 },
    Bladecaster: { name: "Mindshard Surge", cooldown: 4, type: "tactical", dmgMult: 1.5, mpRegen: 15 },
    Mercenery: { name: "Dirty Fighting", cooldown: 3, type: "tactical", dmgMult: 1.4, armorPen: 0.3 }
};

function extractRegex(text, regex, defaultValue = "") {
    const match = text.match(regex);
    return match ? match[1].trim() : defaultValue;
}

function parseStatsFromStatusText(statusText) {
    const stats = { strength: 10, constitution: 10, dexterity: 10, intelligence: 10, resolve: 10, perception: 10 };
    const regex = /(Strength|Constitution|Dexterity|Intelligence|Resolve|Perception):\s*(\d+)/gi;
    let match;
    while ((match = regex.exec(statusText || "")) !== null) {
        const statName = match[1].toLowerCase();
        stats[statName] = parseInt(match[2], 10);
    }
    return stats;
}

function parseCharacterDetails(characterData) {
    const text = characterData.statusText || "";
    return {
        race: extractRegex(text, /Race:\s*([^\n\r]+)/i, characterData.race || "Human"),
        bodyBuild: extractRegex(text, /Body Build:\s*([^\n\r]+)/i, "Average"),
        mainHand: extractRegex(text, /Main Hand:\s*([^\n\r\t]+)/i, "Fists"),
        offHand: extractRegex(text, /Offhand:\s*([^\n\r\t]+)/i, "fists"),
        technique: extractRegex(text, /Combat Technique:\s*([^\n\r\t]+)/i, "Basic Mastery"),
        pain: extractRegex(text, /Pain:\s*([^\n\r\t]+)/i, "0"),
        rest: extractRegex(text, /Rest:\s*([^\n\r\t]+)/i, "Awake"),
        weather: extractRegex(text, /Weather:\s*([^\n\r\t]+)/i, "Clear")
    };
}

// Initialize Character Runtime Stats
function initializeCharacter(characterData) {
    if (!characterData) return null;
    const stats = parseStatsFromStatusText(characterData.statusText);
    const details = parseCharacterDetails(characterData);
    const combatClassInfo = combatClassMapping[characterData.combatClass] || { damageType: "pure physical" };

    let maxHp = stats.constitution <= 25
        ? stats.constitution * 10
        : 250 + (stats.constitution - 25) * 5;
    let maxMp = (stats.intelligence + stats.resolve) * 5;
    let physRes = stats.constitution * 0.4;
    let magRes = stats.resolve * 0.8;
    let physDmg = stats.strength * 1.5 + stats.dexterity * 0.5;
    let magDmg = stats.intelligence * 1.5 + stats.resolve * 0.5;
    let attackSpeed = stats.dexterity * 0.8;

    if (stats.constitution >= 15) {
        attackSpeed -= 1 + (Math.min(stats.constitution, 24) - 15) * 0.25;
        if (stats.constitution >= 25) {
            attackSpeed -= (Math.min(stats.constitution, 34) - 24) * 0.35;
        }
        if (stats.constitution >= 35) {
            attackSpeed -= (stats.constitution - 34) * 0.5;
        }
    }

    function getTieredSpeedBonus(statVal, multiplier = 1.0) {
        if (statVal <= 15) return 0;
        let bonus = 0;
        if (statVal >= 16) bonus += (Math.min(statVal, 20) - 15) * 0.75;
        if (statVal >= 21) bonus += (Math.min(statVal, 25) - 20) * 0.50;
        if (statVal >= 26) bonus += (Math.min(statVal, 30) - 25) * 0.25;
        if (statVal >= 31) bonus += (Math.min(statVal, 35) - 30) * 0.20;
        if (statVal >= 36) bonus += (Math.min(statVal, 40) - 35) * 0.15;
        if (statVal >= 41) bonus += (statVal - 40) * 0.10;
        return bonus * multiplier;
    }

    const dmgType = combatClassInfo.damageType;
    if (dmgType === "pure magic") {
        attackSpeed += getTieredSpeedBonus(stats.intelligence, 1.0);
    } else if (dmgType === "pure physical") {
        attackSpeed += getTieredSpeedBonus(stats.strength, 1.0);
    } else if (dmgType === "hybrid A") {
        attackSpeed += getTieredSpeedBonus(stats.strength, 0.65) + getTieredSpeedBonus(stats.intelligence, 0.35);
    } else if (dmgType === "hybrid B") {
        attackSpeed += getTieredSpeedBonus(stats.intelligence, 0.65) + getTieredSpeedBonus(stats.strength, 0.35);
    }

    let evasion = stats.dexterity * 0.8 + stats.perception * 0.4;
    let critChance = stats.perception * 1.2;
    let blockChance = 0;
    let parryChance = 0;
    let critMult = 1.5 + (stats.perception / 100);

    const mainHand = details.mainHand.toLowerCase();
    const offHand = details.offHand.toLowerCase();

    if (offHand.includes("shield")) {
        blockChance = 25;
        physRes += 6;
        if (offHand.includes("tower")) { blockChance = 35; physRes += 10; evasion -= 5; }
    }

    if (mainHand.includes("katana") || mainHand.includes("rapier") || mainHand.includes("dagger") || mainHand.includes("saber")) {
        parryChance = 5;
    }

    if (mainHand.includes("greatsword") || mainHand.includes("battleaxe") || mainHand.includes("scythe") || mainHand.includes("longsword")) {
        physDmg *= 1.2;
        critMult += 0.25;
        attackSpeed *= 0.9;
    }

    if (mainHand.includes("staff") || mainHand.includes("wand") || mainHand.includes("orb") || mainHand.includes("grimoire")) {
        magDmg *= 1.2;
    }

    let hybridADamage = 0;
    let hybridBDamage = 0;

    if (combatClassInfo.damageType === "pure physical") {
        magDmg = 0;
        maxMp = 0;
    } else if (combatClassInfo.damageType === "pure magic") {
        physDmg = 0;
        magDmg = (stats.intelligence * 2) + (stats.resolve * 0.8);
    } else if (combatClassInfo.damageType === "hybrid A") {
        hybridADamage = (physDmg * 0.8) + (magDmg * 0.2);
    } else if (combatClassInfo.damageType === "hybrid B") {
        hybridBDamage = (magDmg * 0.8) + (physDmg * 0.2);
    }

    const techSpec = classTechniqueSpecs[characterData.combatClass] || {
        name: details.technique || "Basic Strike", cooldown: 4, type: "tactical", dmgMult: 1.4, evadeBuff: 10, buffTurns: 2
    };

    return {
        key: characterData.key,
        name: `${characterData.firstName || "Unknown"} ${characterData.lastName || "Character"}`,
        pixelArtImage: characterData.pixelArtImage,
        combatClass: characterData.combatClass || "Juggernaut",
        potential: characterData.potential || "40 (F)",
        tierInfo: getTierInfo(characterData.potential || "40 (F)"),
        maxHp: Math.round(maxHp),
        hp: Math.round(maxHp),
        maxMp: Math.round(maxMp),
        mp: Math.round(maxMp),
        physRes: Math.round(physRes),
        magRes: Math.round(magRes),
        physDmg: Math.round(physDmg),
        magDmg: Math.round(magDmg),
        hybridADamage: Math.round(hybridADamage),
        hybridBDamage: Math.round(hybridBDamage),
        attackSpeed: Math.round(Math.max(4, attackSpeed) * 10) / 10,
        evasion: Math.round(evasion * 10) / 10,
        critChance: Math.round(critChance * 10) / 10,
        critMult: Math.round(critMult * 100) / 100,
        blockChance,
        parryChance,
        damageType: combatClassInfo.damageType,
        stats,
        details,
        defenseBoostDuration: 0,
        boostApplied: false,
        appliedResBoost: 1.0,
        berserkActive: false,
        techniqueCooldown: 0,
        techniqueSpec: techSpec,
        activeBuffs: {
            physResMult: 1.0,
            evasionBonus: 0,
            critBonus: 0,
            duration: 0
        }
    };
}

// Multi-Hit Attack Chain Calculation
function calculateAttackChain(attackSpeed) {
    let hits = 0;

    if (attackSpeed < 8) {
        let hit1Chance = Math.max(0, attackSpeed / 8);
        if (Math.random() < hit1Chance) hits++;
        else return 0;
    } else {
        hits++;
    }

    if (attackSpeed >= 8) {
        let hit2Chance = attackSpeed >= 16 ? 0.75 : ((attackSpeed - 8) / (16 - 8)) * 0.75;
        if (Math.random() < hit2Chance) hits++;
        else return hits;
    }

    if (attackSpeed >= 16) {
        let hit3Chance = attackSpeed >= 26 ? 0.80 : ((attackSpeed - 16) / (26 - 16)) * 0.80;
        if (Math.random() < hit3Chance) hits++;
        else return hits;
    }

    if (attackSpeed >= 26) {
        let hit4Chance = attackSpeed >= 40 ? 0.82 : ((attackSpeed - 26) / (40 - 26)) * 0.82;
        if (Math.random() < hit4Chance) hits++;
        else return hits;
    }

    if (attackSpeed >= 40) {
        let hit5Chance = attackSpeed >= 60 ? 0.88 : ((attackSpeed - 40) / (60 - 40)) * 0.88;
        if (Math.random() < hit5Chance) hits++;
        else return hits;
    }

    if (attackSpeed >= 60) {
        let hit6Chance = attackSpeed >= 92 ? 1.00 : ((attackSpeed - 60) / (92 - 60)) * 1.00;
        if (Math.random() < hit6Chance) hits++;
        else return hits;
    }

    return hits;
}

// Apply Defensive Boost
function applyDefenseBoost(char, multiplier = 1.5, duration = 2) {
    if (char.boostApplied && char.appliedResBoost > 0) {
        char.physRes /= char.appliedResBoost;
        char.magRes /= char.appliedResBoost;
    }
    char.appliedResBoost = multiplier;
    char.physRes *= multiplier;
    char.magRes *= multiplier;
    char.defenseBoostDuration = duration;
    char.boostApplied = true;
}

// =========================================================
// UI & DISPLAY BINDINGS
// =========================================================

function displayCharacterStats(character, side, currentTurn = 1) {
    const container = side === "left" ? document.getElementById("battleLogLeft") : document.getElementById("battleLogRight");
    if (!container || !character) return;

    const hpPct = Math.max(0, (character.hp / character.maxHp) * 100);
    const mpPct = character.maxMp > 0 ? Math.max(0, (character.mp / character.maxMp) * 100) : 0;

    let techStatus = character.techniqueCooldown === 0 
        ? `<span style="color:#1dd1a1; font-weight:bold;">Ready!</span>` 
        : `<span style="color:#ef476f;">Cooldown (${character.techniqueCooldown}t)</span>`;

    let currentArmorEff = getArmorEfficiency(currentTurn);
    let effPhysArmor = (character.physRes * character.activeBuffs.physResMult) * currentArmorEff;
    let effMagArmor = character.magRes * currentArmorEff;
    
    let armorDecayLabel = currentArmorEff < 1.0 
        ? `<span class="log-slow">(-${Math.round((1 - currentArmorEff) * 100)}% Decay)</span>` 
        : '';

    container.innerHTML = `
        <h3 style="margin: 2px 0;">${character.name}</h3>
        <p style="font-size: 10px; color: #d8c7a7; margin-bottom: 5px;">${character.details.race} | ${character.combatClass} | Dex: ${character.stats.dexterity}</p>
        <div class="stat-display">
            <div class="bar-container">
                <div class="bar-bg"><div class="bar-hp" style="width: ${hpPct}%"></div></div>
                <p>HP: ${character.hp.toFixed(1)} / ${character.maxHp}</p>
            </div>
            ${character.maxMp > 0 ? `
            <div class="bar-container">
                <div class="bar-bg"><div class="bar-mp" style="width: ${mpPct}%"></div></div>
                <p>MP: ${character.mp.toFixed(1)} / ${character.maxMp}</p>
            </div>` : ''}
            <p><strong>Damage Type:</strong> ${character.damageType}</p>
            <p><strong>Attack Speed:</strong> ${character.attackSpeed} (Dex Scaled)</p>
            <p><strong>Technique:</strong> ${techStatus}</p>
            <p><strong>Main Hand:</strong> ${character.details.mainHand}</p>
            <p><strong>Offhand:</strong> ${character.details.offHand}</p>
            <p><strong>Physical Armor:</strong> ${effPhysArmor.toFixed(1)} | <strong>Magic Armor:</strong> ${effMagArmor.toFixed(1)} ${armorDecayLabel}</p>
            <p><strong>Block Chance:</strong> ${character.blockChance}% | <strong>Parry:</strong> ${character.parryChance}%</p>
            <p><strong>Evasion:</strong> ${(character.evasion + character.activeBuffs.evasionBonus).toFixed(1)} | <strong>Crit:</strong> ${(character.critChance + character.activeBuffs.critBonus).toFixed(1)}%</p>
        </div>
    `;
}

// Global Character Database Cache
let allLoadedCharacters = [];

function loadCharacterFromDropdown(characterNumber) {
    const dropdown = characterNumber === 1 ? document.getElementById("characterOneDropdown") : document.getElementById("characterTwoDropdown");
    if (!dropdown) return;
    const characterKey = dropdown.value;
    if (!characterKey) return;

    const characterData = allLoadedCharacters.find(c => c.key === characterKey);
    if (characterData) {
        const character = initializeCharacter(characterData);
        const side = characterNumber === 1 ? "left" : "right";
        displayCharacterStats(character, side, 1);

        const statusElement = characterNumber === 1 ? document.getElementById("characterOneStatus") : document.getElementById("characterTwoStatus");
        if (statusElement) {
            statusElement.innerHTML = `
                <figure style="display: flex; flex-direction: column; align-items: center;">
                    <figcaption style="text-align: center; margin-bottom: 1px;">Emblem</figcaption>
                    <img src="${characterData.pixelArtImage}" alt="Emblem">
                </figure>
                <pre>${characterData.statusText.replace(/Condition\s+[\s\S]*?Combat\s+/g, "Combat\n")}</pre>
            `;
        }
    }
}

function filterAndSortDropdowns() {
    const searchInput = document.getElementById("characterSearchInput");
    const sortSelect = document.getElementById("characterSortSelect");
    const drop1 = document.getElementById("characterOneDropdown");
    const drop2 = document.getElementById("characterTwoDropdown");

    if (!drop1 || !drop2) return;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const sortKey = sortSelect ? sortSelect.value : "name";

    const val1 = drop1.value;
    const val2 = drop2.value;

    let filtered = allLoadedCharacters.filter(c => {
        const full = `${c.firstName} ${c.lastName} ${c.combatClass} ${c.race} ${c.potential}`.toLowerCase();
        return full.includes(searchTerm);
    });

    filtered.sort((a, b) => {
        if (sortKey === 'name') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        if (sortKey === 'tier') return getTierInfo(b.potential).rank - getTierInfo(a.potential).rank;
        if (sortKey === 'class') return (a.combatClass || '').localeCompare(b.combatClass || '');
        if (sortKey === 'race') return (a.race || '').localeCompare(b.race || '');
        return 0;
    });

    drop1.innerHTML = '<option value="">Select Fighter 1...</option>';
    drop2.innerHTML = '<option value="">Select Fighter 2...</option>';

    filtered.forEach(c => {
        const name = `${c.firstName} ${c.lastName} (${c.combatClass || 'No Class'})`;
        drop1.innerHTML += `<option value="${c.key}">${name}</option>`;
        drop2.innerHTML += `<option value="${c.key}">${name}</option>`;
    });

    drop1.value = val1;
    drop2.value = val2;
}

function updateCharacterDropdowns(callback) {
    const request = indexedDB.open("characterDatabase", 3);
    request.onsuccess = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("characters")) return;
        const transaction = db.transaction(["characters"], "readonly");
        const objectStore = transaction.objectStore("characters");
        const cursorRequest = objectStore.openCursor();

        allLoadedCharacters = [];
        cursorRequest.onsuccess = function (event) {
            const cursor = event.target.result;
            if (cursor) {
                allLoadedCharacters.push(cursor.value);
                cursor.continue();
            } else {
                filterAndSortDropdowns();
                if (typeof callback === 'function') callback(allLoadedCharacters);
            }
        };
    };
}

let characterOne, characterTwo;
let battleInterval;
let isPaused = false;
let currentBattleTurn = 1;

function togglePauseBattle() {
    isPaused = !isPaused;
    const btn = document.getElementById("pauseBattleButton");
    if (btn) btn.innerText = isPaused ? "▶️ Resume" : "Pause";
    
    const battleLog = document.getElementById("battleLogCenter");
    if (battleLog) {
        const p = document.createElement('p');
        p.innerHTML = isPaused ? `<span class="log-system">⏸️ Battle Paused mid-turn ${currentBattleTurn}.</span>` : `<span class="log-system">▶️ Battle Resumed.</span>`;
        battleLog.appendChild(p);
    }
}

function startBattle() {
    if (battleInterval) clearInterval(battleInterval);

    const charOneSelect = document.getElementById('characterOneDropdown');
    const charTwoSelect = document.getElementById('characterTwoDropdown');
    if (!charOneSelect || !charTwoSelect) return;

    const characterOneKey = charOneSelect.value;
    const characterTwoKey = charTwoSelect.value;

    if (!characterOneKey || !characterTwoKey) {
        alert("Please select two fighters first.");
        return;
    }

    const char1Data = allLoadedCharacters.find(c => c.key === characterOneKey);
    const char2Data = allLoadedCharacters.find(c => c.key === characterTwoKey);

    if (!char1Data || !char2Data) return;

    characterOne = initializeCharacter(char1Data);
    characterTwo = initializeCharacter(char2Data);

    currentBattleTurn = 1;
    isPaused = false;

    const battleLog = document.getElementById("battleLogCenter");
    if (battleLog) battleLog.innerHTML = '';

    displayEmblems(characterOne, characterTwo);
    displayCharacterStats(characterOne, "left", 1);
    displayCharacterStats(characterTwo, "right", 1);

    const stopBtn = document.getElementById('stopBattleButton');
    const pauseBtn = document.getElementById('pauseBattleButton');
    if (stopBtn) stopBtn.style.display = 'inline-block';
    if (pauseBtn) {
        pauseBtn.style.display = 'inline-block';
        pauseBtn.innerText = "Pause";
    }

    function logMessage(msg) {
        if (!battleLog) return;
        const isNearBottom = (battleLog.scrollHeight - battleLog.scrollTop - battleLog.clientHeight) < 45;
        const p = document.createElement('p');
        p.innerHTML = msg;
        p.style.margin = "3px 0";
        battleLog.appendChild(p);
        
        if (isNearBottom) {
            battleLog.scrollTop = battleLog.scrollHeight;
        }
    }

    const char1HasBow = characterOne.details.mainHand.toLowerCase().includes("bow") || characterOne.details.offHand.toLowerCase().includes("bow");
    const char2HasBow = characterTwo.details.mainHand.toLowerCase().includes("bow") || characterTwo.details.offHand.toLowerCase().includes("bow");

    let firstAttacker = characterOne;
    let secondAttacker = characterTwo;

    if (char1HasBow && !char2HasBow) {
        firstAttacker = characterOne;
        secondAttacker = characterTwo;
        logMessage(`<span class="log-system">🏹 ${characterOne.name} gains Ranged Opening Initiative!</span>`);
    } else if (char2HasBow && !char1HasBow) {
        firstAttacker = characterTwo;
        secondAttacker = characterOne;
        logMessage(`<span class="log-system">🏹 ${characterTwo.name} gains Ranged Opening Initiative!</span>`);
    } else if (characterTwo.attackSpeed > characterOne.attackSpeed) {
        firstAttacker = characterTwo;
        secondAttacker = characterOne;
        logMessage(`<span class="log-system">⚡ ${characterTwo.name} gains Opening Initiative due to higher Attack Speed (${characterTwo.attackSpeed} vs ${characterOne.attackSpeed})!</span>`);
    } else if (characterOne.attackSpeed > characterTwo.attackSpeed) {
        firstAttacker = characterOne;
        secondAttacker = characterTwo;
        logMessage(`<span class="log-system">⚡ ${characterOne.name} gains Opening Initiative due to higher Attack Speed (${characterOne.attackSpeed} vs ${characterTwo.attackSpeed})!</span>`);
    } else if (characterTwo.stats.dexterity > characterOne.stats.dexterity) {
        firstAttacker = characterTwo;
        secondAttacker = characterOne;
        logMessage(`<span class="log-system">⚡ ${characterTwo.name} gains Opening Initiative due to higher Dexterity!</span>`);
    } else {
        firstAttacker = characterOne;
        secondAttacker = characterTwo;
    }

    logMessage(`<span class="log-system">Battle Commenced! ${firstAttacker.name} takes the lead.</span>`);

    function takeTurn(attacker, defender) {
        if (attacker.hp <= 0 || defender.hp <= 0) return;

        if (currentBattleTurn === BALANCING_CONFIG.ARMOR_DECAY_START_TURN) {
            logMessage(`<span class="log-slow">🛡️ Combat Escalation: Armor degradation begins! (-${(BALANCING_CONFIG.ARMOR_DECAY_PER_TURN * 100).toFixed(0)}%/turn)</span>`);
        }
        if (currentBattleTurn === BALANCING_CONFIG.FATIGUE_START_TURN) {
            logMessage(`<span class="log-slow">🥀 Combat Fatigue sets in: Healing efficiency begins decaying! (-${(BALANCING_CONFIG.HEAL_DECAY_PER_TURN * 100).toFixed(0)}%/turn)</span>`);
        }

        if (attacker.techniqueCooldown > 0) attacker.techniqueCooldown--;

        if (attacker.activeBuffs.duration > 0) {
            attacker.activeBuffs.duration--;
            if (attacker.activeBuffs.duration === 0) {
                attacker.activeBuffs.physResMult = 1.0;
                attacker.activeBuffs.evasionBonus = 0;
                attacker.activeBuffs.critBonus = 0;
            }
        }

        if (attacker.damageType === 'pure magic' || attacker.damageType.startsWith('hybrid')) {
            attacker.mp = Math.min(attacker.maxMp, attacker.mp + attacker.stats.resolve * 0.1);
        }

        if ((attacker.details.race.toLowerCase().includes("orc") || attacker.details.race.toLowerCase().includes("goliath")) && !attacker.berserkActive && (attacker.hp / attacker.maxHp) < 0.3) {
            attacker.berserkActive = true;
            attacker.physDmg *= 1.25;
            logMessage(`<span class="log-tech">${attacker.name}'s Racial Instinct triggers BERSERK! Damage boosted!</span>`);
        }

        if (defender.boostApplied) {
            defender.defenseBoostDuration--;
            if (defender.defenseBoostDuration <= 0) {
                defender.physRes /= defender.appliedResBoost;
                defender.magRes /= defender.appliedResBoost;
                defender.boostApplied = false;
                defender.appliedResBoost = 1.0;
            }
        }

        logMessage(`<div class="log-turn">--- Turn ${currentBattleTurn}: ${attacker.name}'s Action ---</div>`);

        let hitsThisTurn = calculateAttackChain(attacker.attackSpeed);

        if (hitsThisTurn === 0) {
            logMessage(`<span class="log-slow">⏳ ${attacker.name} was too slow to react this turn! (AS: ${attacker.attackSpeed.toFixed(1)})</span>`);
            displayCharacterStats(characterOne, "left", currentBattleTurn);
            displayCharacterStats(characterTwo, "right", currentBattleTurn);
            return;
        }

        let primaryMpCost = 0;
        if (attacker.damageType === 'pure magic') primaryMpCost = 25;
        else if (attacker.damageType === 'hybrid A') primaryMpCost = 15;
        else if (attacker.damageType === 'hybrid B') primaryMpCost = 20;

        if (attacker.damageType !== 'pure physical' && attacker.mp < primaryMpCost) {
            let mpRecovered = attacker.stats.resolve * 6;
            attacker.mp = Math.min(attacker.maxMp, attacker.mp + mpRecovered);
            applyDefenseBoost(attacker, 1.5, 2);
            logMessage(`<span class="log-system">🔮 ${attacker.name} has insufficient mana (${attacker.mp.toFixed(1)} MP) for a spell/hybrid strike! Takes a defensive stance and recovers +${mpRecovered.toFixed(1)} MP.</span>`);
            displayCharacterStats(characterOne, "left", currentBattleTurn);
            displayCharacterStats(characterTwo, "right", currentBattleTurn);
            return;
        }

        let isTechniqueTurn = false;
        let techSpec = attacker.techniqueSpec;

        if (attacker.techniqueCooldown === 0) {
            isTechniqueTurn = true;
            attacker.techniqueCooldown = techSpec.cooldown;

            let techDisplayName = attacker.details.technique && attacker.details.technique !== "nothing" 
                ? attacker.details.technique 
                : techSpec.name;

            logMessage(`<span class="log-tech">✨ ${attacker.name} executes Technique: [${techDisplayName}]! (Cooldown: ${techSpec.cooldown}t)</span>`);

            if (techSpec.type === "extra_hits") {
                hitsThisTurn += techSpec.bonusHits || 1;
            } else if (techSpec.type === "ultimate_def") {
                const resBoost = techSpec.resBoost || 1.5;
                applyDefenseBoost(attacker, resBoost, 2);

                let healAmt = attacker.maxHp * (techSpec.healPct || 0.12) * getHealEfficiency(currentBattleTurn);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);

                let fatigueTag = getHealEfficiency(currentBattleTurn) < 1.0 ? ` <span class="log-slow">(${Math.round(getHealEfficiency(currentBattleTurn)*100)}% Heal Eff.)</span>` : '';
                logMessage(`<span class="log-block">🛡️ [${techDisplayName}]: Armor boosted ${resBoost}x and recovered +${healAmt.toFixed(1)} HP!${fatigueTag}</span>`);
            } else if (techSpec.type === "tank_strike" && techSpec.physResBuff) {
                attacker.activeBuffs.physResMult = techSpec.physResBuff;
                attacker.activeBuffs.duration = techSpec.buffTurns || 2;
            } else if (techSpec.type === "tactical") {
                if (techSpec.evadeBuff) attacker.activeBuffs.evasionBonus = techSpec.evadeBuff;
                if (techSpec.critBuff) attacker.activeBuffs.critBonus = techSpec.critBuff;
                attacker.activeBuffs.duration = techSpec.buffTurns || 2;
                logMessage(`<span class="log-tech">⚡ Gained Tactical Evasion & Crit Buff for ${techSpec.buffTurns} turns!</span>`);
            } else if (techSpec.type === "utility_magic") {
                if (techSpec.mpDrain) {
                    let drained = Math.min(defender.mp, techSpec.mpDrain);
                    defender.mp -= drained;
                    attacker.mp = Math.min(attacker.maxMp, attacker.mp + drained);
                    logMessage(`<span class="log-magic">🔮 Drained ${drained.toFixed(1)} MP from ${defender.name}!</span>`);
                }
                if (techSpec.healPct) {
                    let healAmt = attacker.maxHp * techSpec.healPct * getHealEfficiency(currentBattleTurn);
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
                    logMessage(`<span class="log-block">❤️ Recovered +${healAmt.toFixed(1)} HP!</span>`);
                }
            }
        }

        let attackSummaryHeader = hitsThisTurn === 1 ? `1 strike` : `${hitsThisTurn} times in a rapid combo!`;
        logMessage(`⚔️ <strong>${attacker.name}</strong> attacks ${attackSummaryHeader}`);

        for (let i = 0; i < hitsThisTurn; i++) {
            if (defender.hp <= 0) break;

            let attackType = 'physical';
            let baseDamage = attacker.physDmg;
            let mpCost = 0;
            let isFallbackPhysical = false;

            if (attacker.damageType === 'pure magic') {
                attackType = 'magic';
                baseDamage = attacker.magDmg;
                mpCost = 25;
            } else if (attacker.damageType === 'hybrid A') {
                attackType = 'hybridA';
                baseDamage = attacker.hybridADamage;
                mpCost = 15;
            } else if (attacker.damageType === 'hybrid B') {
                attackType = 'hybridB';
                baseDamage = attacker.hybridBDamage;
                mpCost = 20;
            }

            if (attacker.damageType !== 'pure physical' && attacker.mp < mpCost) {
                isFallbackPhysical = true;
                mpCost = 0;
                if (attacker.damageType === 'pure magic') {
                    attackType = 'physical';
                    baseDamage = attacker.physDmg * 0.8;
                } else {
                    attackType = 'physical';
                    baseDamage = attacker.physDmg;
                }
            } else {
                attacker.mp -= mpCost;
            }

            let effectiveEvasion = defender.evasion + defender.activeBuffs.evasionBonus;
            let isDodge = Math.random() < (effectiveEvasion - attacker.stats.perception * 0.2) / 100;
            let isParry = !isDodge && Math.random() < (defender.parryChance / 100);
            let isBlock = !isDodge && !isParry && Math.random() < (defender.blockChance / 100);

            if (isTechniqueTurn) {
                if (techSpec.ignoreDefenses || techSpec.ignoreEvasion) {
                    isDodge = false;
                    isParry = false;
                    if (techSpec.ignoreDefenses) isBlock = false;
                }
            }

            let ordinalPrefix = i === 0 ? "First" : (i === 1 ? "Then" : "Then again");

            if (isDodge) {
                logMessage(`<span class="log-dodge">💨 ${ordinalPrefix}, ${defender.name} swiftly dodged the attack!</span>`);
                continue;
            }

            if (isParry) {
                logMessage(`<span class="log-block">⚔️ ${ordinalPrefix}, ${defender.name} parried the strike with their weapon!</span>`);
                continue;
            }

            let effectiveCritChance = attacker.critChance + attacker.activeBuffs.critBonus;
            if (isTechniqueTurn && techSpec.critChanceBonus) effectiveCritChance += techSpec.critChanceBonus;

            let isCrit = Math.random() < (effectiveCritChance / 100);
            if (isTechniqueTurn && techSpec.guaranteeCrit) isCrit = true;

            let finalDmg = baseDamage * Math.max(0.6, (1 - (i * 0.10)));

            if (isCrit) finalDmg *= attacker.critMult;
            if (isTechniqueTurn && techSpec.dmgMult) finalDmg *= techSpec.dmgMult;

            let currentArmorEff = getArmorEfficiency(currentBattleTurn);
            let effPhysRes = (defender.physRes * defender.activeBuffs.physResMult) * currentArmorEff;
            let effMagRes = defender.magRes * currentArmorEff;

            if (isTechniqueTurn && techSpec.armorPen) effPhysRes *= (1 - techSpec.armorPen);
            if (isTechniqueTurn && techSpec.magPen) effMagRes *= (1 - techSpec.magPen);

            let mitigation = attackType === 'magic' ? effMagRes : effPhysRes;
            if (attackType.startsWith('hybrid')) mitigation = (effPhysRes + effMagRes) * 0.5;

            let minPenetrationFloor = baseDamage * BALANCING_CONFIG.BASE_DAMAGE_PENETRATION_PCT;
            finalDmg = Math.max(minPenetrationFloor, finalDmg - mitigation);

            let fallbackTag = isFallbackPhysical ? ` <span class="log-slow">(Low MP: Physical Fallback)</span>` : '';

            if (isBlock) {
                finalDmg *= 0.3;
                logMessage(`<span class="log-block">🛡️ ${ordinalPrefix}, ${defender.name} raised their shield! Took reduced ${finalDmg.toFixed(1)} ${attackType} damage.${fallbackTag}</span>`);
            } else {
                let dmgClass = attackType === 'magic' ? 'log-magic' : (attackType.startsWith('hybrid') ? 'log-hybrid' : 'log-phys');
                let critText = isCrit ? `<span class="log-crit">(CRITICAL HIT!)</span>` : '';
                
                if (i === 0) {
                    logMessage(`• He dealt <span class="${dmgClass}">${finalDmg.toFixed(1)} ${attackType} damage</span>.${fallbackTag} ${critText}`);
                } else {
                    logMessage(`• He dealt another <span class="${dmgClass}">${finalDmg.toFixed(1)} ${attackType} damage</span>!${fallbackTag} ${critText}`);
                }
            }

            if (isTechniqueTurn && techSpec.lifestealPct) {
                let healed = finalDmg * techSpec.lifestealPct * getHealEfficiency(currentBattleTurn);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
                logMessage(`<span class="log-block">❤️ Lifestealed +${healed.toFixed(1)} HP!</span>`);
            }

            defender.hp -= finalDmg;
            moveEmblem(attacker === characterOne ? 'one' : 'two');
        }

        displayCharacterStats(characterOne, "left", currentBattleTurn);
        displayCharacterStats(characterTwo, "right", currentBattleTurn);
    }

    const speedSelect = document.getElementById("battleSpeedSelect");
    const speedVal = speedSelect ? parseInt(speedSelect.value, 10) : 1200;

    if (speedVal === 0) {
        while (characterOne.hp > 0 && characterTwo.hp > 0) {
            if (isPaused) break;
            const attacker = currentBattleTurn % 2 === 1 ? firstAttacker : secondAttacker;
            const defender = currentBattleTurn % 2 === 1 ? secondAttacker : firstAttacker;
            takeTurn(attacker, defender);
            currentBattleTurn++;
        }
        const victor = characterOne.hp > 0 ? characterOne : characterTwo;
        const defeated = characterOne.hp > 0 ? characterTwo : characterOne;
        logMessage(`<br><h3 class="log-crit">🏆 ${victor.name} is VICTORIOUS! ${defeated.name} has been defeated.</h3>`);
        if (stopBtn) stopBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'none';
    } else {
        battleInterval = setInterval(() => {
            if (isPaused) return;

            const attacker = currentBattleTurn % 2 === 1 ? firstAttacker : secondAttacker;
            const defender = currentBattleTurn % 2 === 1 ? secondAttacker : firstAttacker;

            takeTurn(attacker, defender);

            if (defender.hp <= 0) {
                logMessage(`<br><h3 class="log-crit">🏆 ${attacker.name} is VICTORIOUS! ${defender.name} has been defeated.</h3>`);
                clearInterval(battleInterval);
                if (stopBtn) stopBtn.style.display = 'none';
                if (pauseBtn) pauseBtn.style.display = 'none';
            }

            currentBattleTurn++;
        }, speedVal);
    }
}

function stopBattle() {
    clearInterval(battleInterval);
    const stopBtn = document.getElementById('stopBattleButton');
    const pauseBtn = document.getElementById('pauseBattleButton');
    if (stopBtn) stopBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'none';
    const logCenter = document.getElementById("battleLogCenter");
    if (logCenter) logCenter.innerHTML += '<p class="log-system">Battle manually halted.</p>';
}

function moveEmblem(attacker) {
    const emblem = attacker === 'one' ? document.getElementById('emblemOne') : document.getElementById('emblemTwo');
    if (emblem) {
        emblem.style.transform = attacker === 'one' ? 'translateX(30px)' : 'translateX(-30px)';
        setTimeout(() => { emblem.style.transform = 'translateX(0)'; }, 150);
    }
}

function displayEmblems(char1, char2) {
    const logCenter = document.getElementById("battleLogCenter");
    if (!logCenter || !char1 || !char2) return;
    logCenter.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 10px;">
            <figure style="margin: 0 10px;">
                <img id="emblemOne" src="${char1.pixelArtImage}" alt="${char1.name}">
            </figure>
            <span style="font-size: 18px; font-weight: bold; color: #e0d5c1;">VS</span>
            <figure style="margin: 0 10px;">
                <img id="emblemTwo" src="${char2.pixelArtImage}" alt="${char2.name}">
            </figure>
        </div>
    `;
}

// Auto-wire event listeners if elements exist on the host page
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById('startBattleButton');
    const stopBtn = document.getElementById('stopBattleButton');
    const searchInput = document.getElementById('characterSearchInput');
    const sortSelect = document.getElementById('characterSortSelect');

    if (startBtn) startBtn.addEventListener('click', startBattle);
    if (stopBtn) stopBtn.addEventListener('click', stopBattle);
    if (searchInput) searchInput.addEventListener('input', filterAndSortDropdowns);
    if (sortSelect) sortSelect.addEventListener('change', filterAndSortDropdowns);

    updateCharacterDropdowns();
});

// Expose global BattleSimulator namespace for other HTML pages & arena modules
window.BattleSimulator = {
    config: BALANCING_CONFIG,
    classes: combatClassMapping,
    techniques: classTechniqueSpecs,
    initializeCharacter,
    calculateAttackChain,
    getHealEfficiency,
    getArmorEfficiency,
    getTierInfo,
    parseStatsFromStatusText,
    parseCharacterDetails,
    updateCharacterDropdowns,
    startBattle,
    stopBattle,
    togglePauseBattle,
    getLoadedCharacters: () => allLoadedCharacters
};
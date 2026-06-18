export const UPGRADES = [
  // WEAPONS
  { id: 'dual_shot', name: 'Dual Shot', desc: 'Fires two parallel bullets', type: 'weapon', apply: s => s.dualShot = true },
  { id: 'spread_shot', name: 'Spread Shot', desc: 'Fires 3 bullets in a cone', type: 'weapon', apply: s => s.spreadShot = true },
  { id: 'rear_shot', name: 'Rear Shot', desc: 'Fires an additional bullet backward', type: 'weapon', apply: s => s.rearShot = true },
  { id: 'side_shots', name: 'Side Shots', desc: 'Fires bullets perpendicularly', type: 'weapon', apply: s => s.sideShots = true },
  { id: 'rapid_fire', name: 'Rapid Fire', desc: 'Decreases shoot cooldown by 40%', type: 'weapon', apply: s => s.fireRateMult *= 0.6 },
  { id: 'heavy_caliber', name: 'Heavy Caliber', desc: 'Bullets are 50% faster & larger', type: 'weapon', apply: s => s.heavyBullets = true },
  { id: 'piercing_rounds', name: 'Piercing Rounds', desc: 'Bullets pass through 1 asteroid', type: 'weapon', apply: s => s.piercing = true },
  { id: 'flak_cannon', name: 'Flak Cannon', desc: 'Bullets explode into shrapnel', type: 'weapon', apply: s => s.flak = true },
  { id: 'homing_missiles', name: 'Homing Missiles', desc: 'Bullets curve towards asteroids', type: 'weapon', apply: s => s.homing = true },
  { id: 'bouncing_lasers', name: 'Bouncing Lasers', desc: 'Bullets bounce off screen edges', type: 'weapon', apply: s => s.bouncing = true },
  { id: 'plasma_ball', name: 'Plasma Ball', desc: 'Shoots a massive, slow obliterator', type: 'weapon', apply: s => s.plasma = true },
  { id: 'mine_layer', name: 'Mine Layer', desc: 'Occasionally drops explosive mines', type: 'weapon', apply: s => s.mineLayer = true },
  { id: 'laser_sight', name: 'Laser Sight', desc: 'Draws a faint targeting line', type: 'weapon', apply: s => s.laserSight = true },

  // SHIP PERFORMANCE
  { id: 'overclocked', name: 'Overclocked', desc: 'Increases top speed', type: 'ship', apply: s => s.speedMult *= 1.3 },
  { id: 'agile_turning', name: 'Agile Turning', desc: 'Increases rotation speed by 50%', type: 'ship', apply: s => s.turnMult *= 1.5 },
  { id: 'friction_brakes', name: 'Friction Brakes', desc: 'Stop faster when off thrust', type: 'ship', apply: s => s.frictionMult *= 0.95 },
  { id: 'micro_chassis', name: 'Micro-Chassis', desc: 'Shrinks hitbox by 30%', type: 'ship', apply: s => s.hitboxMult *= 0.7 },
  { id: 'ghost_drive', name: 'Ghost Drive', desc: 'Invincible right after thrusting', type: 'ship', apply: s => s.ghostDrive = true },
  { id: 'deflector_shield', name: 'Deflector Shield', desc: 'Absorbs 1 hit per wave', type: 'ship', apply: s => s.shield = true },
  { id: 'reflective_hull', name: 'Reflective Hull', desc: 'Emit blast of bullets when hit', type: 'ship', apply: s => s.reflective = true },
  { id: 'ramming_speed', name: 'Ramming Speed', desc: 'Safe to hit asteroids at max speed', type: 'ship', apply: s => s.ramming = true },

  // UTILITY
  { id: 'extra_plating', name: 'Extra Plating', desc: '+1 Max Life instantly', type: 'utility', apply: s => { s.maxLives++; s.lives++; } },
  { id: 'scrap_collector', name: 'Scrap Collector', desc: 'Small chance to drop an Extra Life', type: 'utility', apply: s => s.scrapCollector = true },
  { id: 'combo_master', name: 'Combo Master', desc: 'Combo multiplier drops slower', type: 'utility', apply: s => s.comboDecayMult *= 0.5 },
  { id: 'deep_pockets', name: 'Deep Pockets', desc: 'Double base score from asteroids', type: 'utility', apply: s => s.scoreMult *= 2 },
  { id: 'emp_blast', name: 'EMP Blast', desc: 'Destroys small asteroids on wave start', type: 'utility', apply: s => s.emp = true },
  { id: 'chrono_drive', name: 'Chrono Drive', desc: 'Asteroids slow down when off thrust', type: 'utility', apply: s => s.chrono = true },
  { id: 'radioactive', name: 'Radioactive Rocks', desc: 'Asteroids sometimes explode violently', type: 'utility', apply: s => s.radioactive = true },
  { id: 'gravity_well', name: 'Gravity Well', desc: 'Spawns a mini black hole each wave', type: 'utility', apply: s => s.gravityWell = true },
  { id: 'ufo_hunter', name: 'UFO Hunter', desc: 'More UFOs, but massive rewards', type: 'utility', apply: s => s.ufoHunter = true }
];

export function getRandomUpgrades(count, currentUpgrades) {
  // Filter out upgrades the player already has (except stackable ones like extra plating)
  let pool = UPGRADES.filter(u => {
    if (u.id === 'extra_plating') return true;
    return !currentUpgrades.includes(u.id);
  });
  
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  
  return pool.slice(0, count);
}

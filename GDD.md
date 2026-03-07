# Game Design Document — Gungeon

## Overview

**Genre:** Twin-stick shooter meets roguelike dungeon crawler  
**Platform:** Browser (WebGL) / Electron  
**Session Length:** Longer runs than Enter the Gungeon - play, shoot, loot, save. Traditional roguelike pacing.  
**Players:** Single-player  
**Elevator Pitch:** Enter the Gungeon meets Angband. Descend into procedurally generated dungeons, kill enemies with guns that level up as you use them, find better weapons, dodge-roll through danger, and fight your way to the boss at the bottom.

**Art Style:**  
- **Environment:** Cell-shaded 3D with bold black outlines. Big blocky geometry, Gungeon style but in 3D. Simple, readable, elemental.
- **Characters/Enemies:** TBD - need reference art to define style.

**Reference Games:** Enter the Gungeon (combat feel, art direction), Angband (dungeon structure, vaults, depth progression)

---

## Core Loop

**Every 30 seconds (moment-to-moment):**  
You're moving through the dungeon, aiming with your mouse (or right stick), shooting enemies as they appear. Dodge-roll through bullets and enemy charges. Collect XP gems that fly toward you from kills. Seamlessly switch between your two guns (sidearm and long arm) - switching to your sidearm is faster than reloading your long arm. Reload when your magazine empties.

**Every 5 minutes (tactical layer):**  
You've cleared a section of the dungeon. Found a new gun - do you swap it for your current sidearm or long arm? Your assault rifle has enough XP - open the upgrade menu (Tab) and spend it on fire rate or projectile count. Encounter a mini-boss (sized-up enemy with more health). Find a shop - spend currency on a health pickup. Keep pushing deeper.

**Every session (strategic layer):**  
Start fresh: pick your starting long arm (assault rifle, SMG, or shotgun). Start with a pistol as your sidearm. Descend floor by floor, enemies getting tougher. Guns level up through repeated use. Find rare guns with better trait combos. Eventually reach the boss at the bottom and fight for victory. Permadeath if you fall - back to the main menu, start over.

**Tension:** Permadeath. Enemies get harder as you descend (more HP, more damage, faster, more shields). Resource management (health pickups are rare, shops are limited).

**Satisfaction:** Finding a powerful gun. Leveling up your favorite gun until it's a monster. Landing critical hits. Dodge-rolling through a bullet hell moment unscathed. Reaching a new depth you've never seen before.

---

## Entities

### Player Character

A person. No specific identity or backstory (leave it open like Gungeon does).

**Stats:**
- **Health:** 100 HP (base)
- **Armor:** 0 (can be found/upgraded later)
- **Shields:** 0 (can be found/upgraded later)
- **Movement Speed:** (tunable design param)
- **Dodge Roll:** Cooldown-based dash with invincibility frames

**Weapons:** Carries two guns simultaneously:
- **Sidearm slot:** Pistol (default starter), swappable with other sidearms found in dungeon
- **Long arm slot:** SMG / Assault Rifle / Shotgun / LMG, swappable with other long arms

Both guns level independently. Killing enemies with a gun grants that gun XP. Each gun has 3 levelable traits chosen from a pool of 12.

### Enemies

All enemies scale with depth - higher depth means higher stats (HP, damage, speed, shields) and potentially new abilities.

**Enemy Types (MVP):**

1. **Knife Rushers**  
   Melee enemies. Sprint at the player, try to close distance and stab. Low HP but fast.

2. **Shield + Gun Enemies**  
   Hold a shield that blocks frontal damage. Shoot at the player from behind cover. Player must flank or use piercing shots.

3. **Shotgunners**  
   Medium-range enemies. Fire spread shots that deal high damage up close. Slow fire rate but deadly if you get too near.

4. **Riflemen**  
   Long-range precise shooters. Single accurate shots. Good HP, moderate speed.

5. **Suicide Bombers**  
   Rush the player and explode on contact or when killed. Area damage. High threat, low HP.

**Mini-Bosses:**  
Sized-up versions of regular enemies with different colors. Higher stats across the board. (Real unique boss encounters are stretch goals.)

**Boss (Bottom Floor):**  
A final boss encounter to win the run. Design TBD, but likely a sized-up enemy with multiple phases or enhanced behavior.

### Guns

Guns are the core progression system. Each gun has:
- **Base stats:** damage, fire rate, magazine size, reload time, spread, etc.
- **3 levelable traits** (picked from the pool below)
- **Independent XP bar** (kills with this gun level this gun)

**Gun Trait Pool (12 total):**
1. **Damage** - bullet damage per hit
2. **Fire Rate** - shots per second
3. **Magazine Size** - bullets before reload
4. **Reload Time** - seconds to reload
5. **Spread** (accuracy) - tighter = more accurate
6. **Projectile Count** - bullets per shot (e.g., shotgun pellets)
7. **Projectile Speed** - how fast bullets travel
8. **Knockback** - pushes enemies back on hit
9. **Critical Chance** - % chance for crit
10. **Critical Multiplier** - damage multiplier on crit (2x, 3x, etc.)
11. **Piercing** - number of enemies/walls bullet passes through
12. **Bouncing** - number of bounces off enemies and walls before bullet disappears

**Note:** Piercing and Bouncing are **mutually exclusive** - a gun can have one or the other as a levelable trait, but not both.

Each gun picks 3 traits that can be leveled. Rare guns have more desirable trait combos (e.g., damage + crit chance + crit multiplier).

**Gun Types (MVP):**

**Sidearms:**
- **Pistol** (starter) - Accurate, moderate damage. Rewards precision. Thematic traits: Damage, Critical Chance, Critical Multiplier.

**Long Arms:**
- **SMG** - High fire rate, low damage, large magazine. Thematic traits: Fire Rate, Magazine Size, Projectile Speed.
- **Assault Rifle** (starter option) - Balanced. Thematic traits: Fire Rate, Projectile Count, Projectile Speed.
- **Shotgun** (starter option) - High damage, spread shot. Thematic traits: Projectile Count, Spread, Damage.
- **LMG** - High damage, slow fire rate, huge magazine. Thematic traits: Damage, Magazine Size, Knockback.

(More gun types can be added: revolver, burst rifle, grenade launcher, etc. Special guns like grenade launcher are temporary pickups, not permanent weapons.)

**Gun Leveling Flow:**
- Kill enemies with a gun → enemy drops gun-specific XP gems for that gun
- XP gems auto-fly to player (Vampire Survivors style) and add to that gun's XP pool
- Each trait has individual levels and costs (trait at level 1 is cheap, trait at level 5 is expensive)
- HUD shows indicator when gun has enough XP to upgrade any trait
- Player presses Tab to open upgrade menu and manually spend XP on a trait
- **Exception:** When gun has enough XP to afford the MOST EXPENSIVE trait upgrade, game pauses and forces upgrade screen (no excuse to wait)

### Projectiles

**Player Bullets:**  
Visible projectiles (not tracers - actual 3D bullets). Behavior depends on gun traits (straight shots by default, spread for shotguns, piercing/bouncing if leveled).

**Enemy Bullets:**  
Visible projectiles fired by ranged enemies. Straight shots (no homing in v1).

### Pickups

**XP Gems:**  
Dropped by killed enemies - the gem is typed to the gun that got the kill. Auto-fly to player (Vampire Survivors style) and add to that gun's XP pool. Collection range could be a passive upgrade later (stretch).

**Health Pickups:**  
Rare drops from enemies. Restore HP.

**Currency:**  
Dropped by enemies or found in the dungeon. Used at shops to buy health.

**Guns:**  
Found in the dungeon (chests, rooms, drops). Can be swapped into sidearm or long arm slot.

### Environment

**Terrain:**  
Flat 3D floors with walls. Cell-shaded blocky geometry with black outlines.

**Hazards:**
- **Pits:** Impassable (block movement, act as walls)
- **Fire:** Damage over time when standing in it
- **Spikes:** Damage when stepped on
- **Water:** Slows movement speed

**Cover:**  
Destructible objects in rooms that block line-of-sight and gunfire. Crates, pillars, furniture. Break apart when shot.

**Doors:**  
Connect dungeon areas. Open automatically when approached (or when room is cleared?).

---

## World and Levels

**Dungeon Structure:**  
Procedurally generated levels descending into the depths. No discrete "rooms" like Gungeon - continuous interconnected spaces. Running fights can flow between areas.

**Procedural Generation:**  
Levels are generated using an algorithm + a library of **authored vault templates**. Vaults are pre-designed room patterns, enemy configurations, and loot placements that get randomly inserted during generation (Angband/Zangband style). Vaults are authored (hand-designed), but their placement is procedural.

**Depth Progression:**  
Each level is deeper than the last. Enemies scale with depth (higher stats). New enemy types may appear at greater depths. Eventually reach the boss floor.

**Camera:**  
Isometric-esque 3D perspective. Follows the player. Maybe allow rotation and zoom if it feels good (tunable).

---

## UI and Feedback

### HUD (always visible during gameplay)

- **Health Bar** (top-left or bottom-left)
- **Armor Bar** (if player has armor)
- **Shield Bar or Shield Pips** (design TBD)
- **Current Gun Display** - icon/image of active gun with clear visual indicator (border, glow, etc.)
- **Alternate Gun Display** - icon/image of inactive gun, clearly distinguished from active
- **Magazine / Ammo Display** (bullets remaining in current gun's magazine)
- **Upgrade Available Indicator** (small icon/glow when a gun has XP to spend)

### Screen Flow

1. **Launch Game** → **Main Menu**
   - New Game
   - Continue (if save exists)
   - Settings
   - Quit

2. **New Game** → **Character Select** (v1: only 1 character, screen may be skipped or placeholder)

3. **Character Select** → **Starting Weapon Select**  
   Choose 1 of 3 long arms (Assault Rifle, SMG, Shotgun). Pistol is given automatically as sidearm.

4. **Starting Weapon Select** → **Gameplay**

5. **During Gameplay:**
   - Press **E** on gun pickup → **Gun Comparison Screen** (compare stats, swap guns)
   - Press **Tab** → **Gun Upgrade Menu** (spend XP on traits)
   - Press **Esc** → **Pause Menu** (Resume, Settings, Quit)

6. **On Death (permadeath):**
   - **Death Screen** - show stats (kills, time survived, depth reached, etc.)
   - "Restart" button → back to Main Menu

### In-Game UI Interactions

**Gun Pickup / Compare:**  
When player approaches a gun on the ground, a prompt appears: "Press E to Compare" (or gamepad button). Pressing the button **pauses the game** and opens the **Gun Comparison Screen**.

**Gun Comparison Screen:**  
Side-by-side display:
- **Left:** Current gun in that slot (sidearm or long arm)
- **Right:** New gun on the ground
- Shows for each gun: icon/image, name, base stats (damage, fire rate, magazine size, reload time, spread, etc.), levelable traits (which 3 traits this gun can upgrade), current trait levels (if applicable for your current gun)
- Buttons: "Swap" (replace current gun with new gun), "Cancel" (close screen, resume game)

**Gun Upgrade Menu (Tab):**  
Pauses the game. Shows current gun's XP, traits, costs. Click a trait to spend XP and level it up. Close menu, resume playing.

**Forced Level-Up Screen:**  
When gun XP >= cost of most expensive trait, game pauses and shows upgrade screen automatically. Player must spend XP before continuing.

### Visual Feedback

**Hit Feedback:**
- **Damage Numbers** - pop up above enemies when hit (color-coded for crits?)
- **Blood/Sparks** - particle bursts on impact (blood for organics, sparks for mechanical enemies?)
- **Screen Shake** - on big hits, explosions, or player damage (subtle, not nauseating)

**Particles:**
- **Muzzle Flash** - brief flash at gun barrel when firing
- **Bullet Impact Effects** - sparks/dust when bullets hit walls or cover
- **Explosions** - suicide bombers, destructible objects
- **XP Gem Glow** - gems pulse/glow as they fly to player

**Juice Level:**  
Over-the-top and satisfying. Every action should feel impactful. Tight, responsive, punchy. Not floaty.

---

## Audio

**Music:**  
Stretch goal - not in v1. (Menu music, gameplay music, boss music planned for later.)

**Sound Effects (exhaustive list):**

**Weapons:**
- Fire sound (unique per gun type: pistol crack, SMG chatter, shotgun boom, assault rifle burst, LMG thud)
- Reload sound (per gun type)
- Empty clip click (when trying to fire with empty magazine)

**Player:**
- Footsteps (subtle, doesn't clutter)
- Dodge roll (whoosh sound)
- Player hit/damage grunt
- Player death sound

**Enemies:**
- Enemy hit sounds (impact on flesh/armor)
- Enemy death sounds (per type)
- Enemy attack sounds (melee swings, gun shots)
- Explosion (suicide bombers)

**Pickups:**
- XP gem pickup (light chime or "pop")
- Health pickup (healing sound)
- Currency pickup (coin clink)
- Gun pickup (heavier "equip" sound)

**UI:**
- Menu click
- Menu hover
- Level-up notification (ding or alert)
- Upgrade spent (confirmation sound)
- Pause/unpause

**Environment:**
- Door open
- Destructible object breaking (wood crunch, stone shatter)
- Hazard ambient (fire crackle)

**Spatial Audio:**  
Not required for v1, but could be added (enemy footsteps getting louder as they approach).

---

## Interactions

### Player vs Enemy

**Ranged Combat:**  
Player aims with mouse (or right stick). Left-click (or right trigger) to fire. Bullets travel as visible projectiles. Hit enemies for damage (based on gun's damage stat + crits + traits). Knockback trait pushes enemies away.

**Melee Combat (enemies only):**  
Knife rushers and suicide bombers deal damage on contact with player. Player has no melee attack (guns only).

**Dodge Roll:**  
Player presses Space/Shift (or gamepad button) to roll in movement direction. Short dash with invincibility frames (i-frames). Has cooldown - can't spam. Use to avoid damage, reposition, escape tight spots.

### Player vs Projectiles

Enemy bullets are solid objects. Can be avoided by moving or dodge-rolling (i-frames make you invincible during roll). Bullets that miss hit walls or despawn.

### Player vs Pickups

**XP Gems:**  
Auto-collect. Gems fly toward player when within collection range (Vampire Survivors style). XP goes to the gun that killed the enemy.

**Health / Currency / Guns:**  
Manual pickup. Walk over them or press interact key (E).

### Player vs Environment

**Walls:**  
Block movement. Block bullets (both player and enemy).

**Cover (destructible objects):**  
Block movement and line-of-sight. Block bullets. Take damage from bullets and break apart after enough hits.

**Hazards:**
- **Pits:** Impassable terrain (act like walls).
- **Fire:** Deal damage per second while player stands in it.
- **Spikes:** Deal damage when player steps on them (one-time or repeating?).
- **Water:** Slows player movement speed (no damage).

**Doors:**  
Player walks through (automatically open?). Connect dungeon areas.

### Enemy vs Enemy

**No Friendly Fire (v1):**  
Enemies don't damage each other. Simplifies combat, avoids edge cases.

### Projectile vs Environment

**Bullets hit walls:**  
Bullets disappear on impact (unless they have Piercing trait).

**Bullets hit cover:**  
Destructible objects take damage and eventually break. Bullets with Piercing can pass through.

**Bouncing trait:**  
Bullets with Bouncing trait ricochet off walls (number of bounces depends on trait level).

---

## Progression

### Within a Run

**Gun Leveling:**  
Killing enemies drops gun-specific XP gems. Each gun has 3 levelable traits. Spend XP to increase trait levels. Traits get more expensive at higher levels (level 1 is cheap, level 5 is expensive).

**Finding New Guns:**  
Explore the dungeon. Open chests, kill mini-bosses, search rooms. Find new guns. Swap into your sidearm or long arm slot if better.

**Currency Economy:**  
Collect currency from kills or exploration. Spend at shops to buy health pickups. (More shop inventory in future: armor, shields, temporary buffs.)

**Depth Progression:**  
Descend deeper into the dungeon. Enemies get tougher (stat scaling). Reach new depths. Eventually fight the boss.

### Between Runs

**Permadeath:**  
When you die, you lose everything. Back to main menu. No meta-progression or unlocks in v1.

**Stretch Goals (future):**  
- Meta-progression: unlock new starting weapons, new characters
- Permanent upgrades (e.g., start with +10% damage)
- Vault of unlockable guns that can appear in runs

---

## Economy

### Resources

**XP (gun-specific):**  
Dropped as gems by killed enemies - gem is typed to the gun that got the kill. Used to level that gun's traits. Cannot transfer XP between guns.

**Currency:**  
Dropped by enemies or found in the dungeon. Used at shops.

**Health:**  
Player's HP. Rare resource - health pickups are uncommon.

### Costs

**Gun Trait Upgrades:**  
Each trait level costs XP. Level 1 is cheap, level 5 is expensive. Costs scale per trait and per level.

**Shop Purchases:**  
Health pickups cost currency (amount TBD, tunable).

### Scarcity

**Health is precious:**  
Rare drops, expensive at shops. Player must play carefully to avoid damage.

**XP is plentiful but gun-specific:**  
Plenty of enemies to kill, but XP only levels the gun you used. Switching guns often means slower progression per gun. Specializing in one gun makes it powerful.

**Currency is moderate:**  
Enough to buy a few health pickups per run, but not unlimited. Forces choice: buy health now or save for later?

### Balance Levers

Designers can tune:
- Enemy HP, damage, speed per depth level
- XP drop amounts
- Trait upgrade costs (make leveling faster/slower)
- Currency drop rates
- Shop prices
- Gun base stats (damage, fire rate, etc.)
- Player base stats (health, movement speed, dodge roll cooldown)

---

## Controls

### Input Methods

**Keyboard + Mouse:**  
- **Movement:** WASD
- **Aim:** Mouse (free 360° aiming)
- **Fire Sidearm:** Left-click (seamless switch to sidearm)
- **Fire Long Arm:** Right-click (seamless switch to long arm)
- **Reload:** R (reloads current gun)
- **Dodge Roll:** Space or Shift
- **Interact:** E (pick up items, open chests)
- **Upgrade Menu:** Tab
- **Pause:** Esc

**Gamepad (twin-stick):**  
- **Movement:** Left stick
- **Aim:** Right stick (360° aiming)
- **Fire Long Arm:** Right trigger (RT) - seamless switch and fire
- **Fire Sidearm:** Left trigger (LT) - seamless switch and fire
- **Reload:** X or Square (reloads current gun)
- **Dodge Roll:** A or X (face button) or Left Bumper (LB)
- **Interact:** B or Circle
- **Upgrade Menu:** Back/Select or Touchpad
- **Pause:** Start or Options

**Design Note:** Switching to your sidearm is faster than reloading your long arm. Players can seamlessly fire either gun at any time - pulling the trigger/clicking the button automatically switches to that gun if it's not active. No manual weapon swap needed.

### Responsiveness

**Tight and Snappy:**  
Inputs should feel instant. Shooting has no delay. Dodge roll is immediate. Movement is responsive (no acceleration unless it feels good). This is a fast-paced action game - controls must be precise.

---

## Win / Lose Conditions

### Lose

**Permadeath:**  
When player health reaches 0, the run ends. Player sees death screen with stats, then returns to main menu. All progress (guns, upgrades, depth) is lost. Start fresh on next run.

### Win

**Boss Victory:**  
Reach the bottom floor and defeat the boss. Victory screen (stats, maybe a message). Return to main menu.

**Future (Stretch):**  
Endless mode - survive as long as possible, track high score or deepest depth.

---

## Scope and Priorities

### Minimum Viable Product (v1)

What we MUST have for the game to be fun:

- Twin-stick shooter controls (keyboard+mouse and gamepad)
- Player character with dodge roll
- 5 enemy types (rushers, shield+gun, shotgunners, riflemen, bombers)
- 5 gun types (pistol, SMG, assault rifle, shotgun, LMG)
- Gun leveling system with 12 traits, each gun picks 3
- XP collection and upgrade menu
- Procedural dungeon generation (one level type, infinite depth)
- Environmental hazards (pits, fire, spikes, water)
- Destructible cover
- Health pickups and currency
- Basic shops (selling health)
- Mini-bosses (sized-up enemies)
- Final boss encounter
- HUD with health, guns, ammo, upgrade indicator
- Damage numbers, blood/sparks, muzzle flash
- Sound effects for all actions
- Permadeath and death screen
- Main menu, settings, pause menu

### Out of Scope for v1

What we are NOT doing in the first version:

- Music (stretch goal)
- Meta-progression or unlocks between runs
- Character variety (only 1 character in v1)
- Upgrades to dodge roll, armor, shields (stretch goals)
- Drones or companions
- Custom authored vaults (procedural generation uses algorithm only, vaults are stretch)
- Real unique bosses or mini-bosses with special mechanics (v1 uses sized-up enemies)
- Special projectile types beyond piercing/bouncing (homing, elemental effects, etc. are stretch)
- Advanced shop inventory (only health in v1)
- Multiple level types or biomes (one dungeon aesthetic for v1)

### Stretch Goals

Features we want but can add after v1 is playable:

- Music (menu, gameplay, boss)
- Meta-progression (unlockable starting weapons, characters, permanent upgrades)
- Dodge roll upgrades (cooldown, distance, i-frames)
- Passive upgrades (armor, shields, drones, XP collection range)
- Authored vault library (special rooms, challenges, guaranteed loot)
- Real boss and mini-boss encounters with unique mechanics
- More gun types (revolver, burst rifle, sniper, grenade launcher, rocket launcher)
- Special ammo types (homing, elemental, explosive)
- More shop inventory (armor, shields, buffs, gun mods)
- Multiple biomes with different aesthetics
- Leaderboards or score tracking
- Endless mode

---

## Assets

This section lists all art, audio, and data assets needed for v1.

### 3D Models / Sprites

**Player:**
- Player character model/sprite (TBD art style)
- Dodge roll animation

**Enemies (5 types):**
- Knife Rusher model/sprite + attack animation
- Shield + Gun enemy model/sprite + shield model + attack animation
- Shotgunner model/sprite + attack animation
- Rifleman model/sprite + attack animation
- Suicide Bomber model/sprite + explosion animation

**Weapons (5 types + variations):**
- Pistol model
- SMG model
- Assault Rifle model
- Shotgun model
- LMG model
- (More gun models for rare variants/loot)
- **Gun icons/images** for each weapon (used in HUD, comparison screen, upgrade menu, etc.)

**Environment:**
- Wall tiles/blocks (cell-shaded with black outlines)
- Floor tiles
- Pit tiles
- Fire hazard (animated)
- Spike hazard
- Water hazard (animated)
- Destructible cover objects (crates, pillars, barrels, etc.) +破destroyed states
- Door model/sprite

**Pickups:**
- XP gem model (maybe different colors per gun type?)
- Health pickup model
- Currency pickup model (coins?)
- Gun pickup indicator (glow/outline when gun on ground)

**UI Elements:**
- Health bar
- Armor bar
- Shield bar/pips
- Gun icons (all weapon types for HUD, comparison screen, upgrade menu)
- Magazine/ammo display
- Upgrade available indicator
- Crosshair/reticle
- Gun comparison screen layout (side-by-side stat display)
- Gun pickup prompt ("Press E to Compare")

**Effects:**
- Muzzle flash sprite/particle
- Bullet projectile model (small 3D object)
- Blood/sparks particle on hit
- Explosion particle (suicide bombers, destructibles)
- XP gem glow/trail particle
- Damage number font/rendering

**Menus:**
- Main menu background
- Gun comparison screen background/UI elements
- Upgrade menu background/UI elements
- Death screen layout

### Sound Effects

**Weapons (per gun type):**
- Pistol fire
- SMG fire
- Assault Rifle fire
- Shotgun fire
- LMG fire
- Reload sound (per gun type, or generic)
- Empty clip click

**Player:**
- Footsteps
- Dodge roll whoosh
- Player hit/damage grunt
- Player death sound

**Enemies:**
- Enemy hit (flesh impact)
- Enemy hit (armor impact)
- Enemy death (per type, or generic)
- Knife swing
- Enemy gunshot
- Explosion (suicide bomber)

**Pickups:**
- XP gem pickup (light chime)
- Health pickup (healing sound)
- Currency pickup (coin clink)
- Gun pickup (equip sound)

**UI:**
- Menu click
- Menu hover
- Gun comparison screen open
- Gun swap confirmation
- Level-up notification (ding)
- Upgrade spent (confirmation)
- Pause/unpause

**Environment:**
- Door open
- Destructible object break (wood, stone, metal variants)
- Fire ambient crackle
- Water ambient

### Data / Configuration

**Design Parameters (JSON):**
- Player stats (HP, movement speed, dodge roll cooldown/distance/i-frames)
- Gun base stats (damage, fire rate, magazine size, reload time, spread, etc.) for all gun types
- Trait upgrade costs (XP cost per trait level)
- Enemy stats per type per depth level (HP, damage, speed, shields)
- Hazard damage values
- Shop prices
- XP drop amounts
- Currency drop amounts
- Collection range for XP gems

**Procedural Generation Config:**
- Dungeon generation algorithm parameters
- Vault templates (if included in v1)

**Localization (optional for v1):**
- UI text strings (English)

### Music (Stretch Goal, not in v1)

- Main menu music
- Gameplay music (ambient/combat)
- Boss music
- Victory/death stings

---

## Open Questions

Questions that don't need answers yet but will come up during implementation:

1. **Dodge roll tuning:** Exact cooldown, distance, i-frame duration will need playtesting.
2. **Enemy stat scaling formula:** How much do HP/damage/speed increase per depth level?
3. **XP costs per trait level:** Need a curve that feels good (not too grindy, not too easy).
4. **Currency drop rates and shop prices:** Balance for scarcity without frustration.
5. **Vault design:** If vaults are added, what patterns make them fun? High-risk/high-reward?
6. **Boss design:** What does the final boss do? Multiple phases? Unique attacks?
7. **Gun rarity tiers:** Should some guns be "common" vs "rare" with better trait combos? How to communicate rarity?
8. **Character/enemy art style:** Need reference art to finalize character aesthetics (environment is defined as cell-shaded blocks).
9. **Magazine size as balance lever:** Larger magazines make guns stronger - how to balance this against other traits?
10. **Bouncing mechanics:** Bullets with Bouncing trait bounce off enemies AND walls (both count toward the bounce limit). Does bouncing off an enemy deal damage again, or just redirect the bullet?
11. **Destructible cover HP:** How many shots to break a crate? Should it depend on gun damage?
12. **Door behavior:** Auto-open on approach, or only after clearing enemies in a section?
13. **Save system:** You mentioned "save" - does the game auto-save at depth milestones, or only on quit? (Permadeath but can continue a run later?)

---

**End of GDD**

This document describes WHAT the game is. The next step is the Technical Design Document (TDD), which will describe HOW to build it.

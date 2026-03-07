# Asset Inventory

All assets are external files loaded at runtime. Each asset has a spec in `asset-specs/`. Assets are referenced by enum values through manifests. Swapping an asset is a file replacement.

## Placeholder Strategy

Every asset starts as a placeholder:
- **3D models:** Colored box/cylinder geometry generated in code. No file needed.
- **Textures:** Solid color or checkerboard pattern generated as canvas textures.
- **Sound effects:** Generated tones (sine/square wave bursts) using Web Audio API or silent audio files.
- **Icons/UI images:** Colored rectangles with text labels rendered via canvas.

Placeholders are functional — the game is fully playable with them. Real assets are swapped in by replacing the file at the manifest path.

**Future GLB loading:** The architecture supports loading GLB models via Three.js `GLTFLoader`. v1 uses generated geometry mapped by `MeshId` enum. Post-v1, the scene manager maps `MeshId` values to GLB file paths instead of geometry generators. No system-level changes needed.

## 3D Models

All models use simple generated geometry for v1 (no external GLB files). Cell-shaded look is achieved with MeshToonMaterial + outline meshes.

| Asset | MeshId | Placeholder | Notes |
|-------|--------|-------------|-------|
| Player character | `Player` | Blue box (1x2x1) | Outline mesh for cell-shading |
| Knife Rusher | `KnifeRusher` | Red box (0.8x1.5x0.8) | Fast-looking, short |
| Shield+Gun enemy | `ShieldGun` | Green box (1x2x1) + flat plane shield | Shield is separate child mesh |
| Shotgunner | `Shotgunner` | Orange box (1.2x2x1.2) | Slightly wider |
| Rifleman | `Rifleman` | Purple box (0.8x2x0.8) | Tall and thin |
| Suicide Bomber | `SuicideBomber` | Yellow sphere (r=0.6) | Round = bomb |
| Mini-boss variants | `MiniBoss*` | Same as base type, 1.5x scale, darker color | Per-type mini-boss MeshId |
| Boss | `Boss` | Large dark red box (2x3x2) | Imposing scale |
| Pistol | `Pistol` | Small dark gray box (0.1x0.1x0.3) | Attached to player mesh |
| SMG | `SMG` | Small gray box (0.1x0.1x0.4) | |
| Assault Rifle | `AssaultRifle` | Medium gray box (0.1x0.1x0.5) | |
| Shotgun | `Shotgun` | Wide gray box (0.15x0.1x0.5) | |
| LMG | `LMG` | Large gray box (0.15x0.15x0.6) | |
| Player bullet | `Bullet` | Tiny yellow sphere (r=0.05) | Emissive material |
| Enemy bullet | `EnemyBullet` | Tiny red sphere (r=0.05) | Emissive material |
| XP gem | `XPGem` | Small cyan octahedron (r=0.15) | Emissive + glow |
| Health pickup | `HealthPickup` | Green cross shape | |
| Currency | `Currency` | Gold cylinder (coin) | |
| Gun pickup glow | `GunPickupGlow` | White glow ring | Floating + rotating |
| Wall block | `Wall` | Gray box | Instanced, toon shaded |
| Floor tile | `Floor` | Dark gray plane | Instanced |
| Pit tile | `Pit` | Black plane (or no mesh — void) | |
| Fire hazard | `FireHazard` | Orange/red plane with emissive | |
| Spike hazard | `SpikeHazard` | Gray plane with small pyramids | |
| Water hazard | `WaterHazard` | Blue translucent plane | |
| Crate (destructible) | `Crate` | Brown box | |
| Pillar (destructible) | `Pillar` | Gray cylinder | |
| Barrel (destructible) | `Barrel` | Brown cylinder | |
| Door | `Door` | Brown box, flatter | Slides open on Y axis |
| Chest | `Chest` | Brown box with gold lid | Lid rotates open |
| Shop | `Shop` | Teal box with signage | |
| Stairs | `Stairs` | Gray stepped geometry | |
| Enemy shield | `EnemyShieldMesh` | Flat blue-gray plane | Child of ShieldGun mesh |

## Particles / Effects

All particle definitions stored in `config/particle-manifest.json` (schema defined in config.md).

| Asset | ParticleEffect | Placeholder | Notes |
|-------|---------------|-------------|-------|
| Muzzle flash | `MuzzleFlash` | Yellow emissive sprite, 2 frames | Billboard sprite at gun tip |
| Blood/impact (enemy) | `BloodSplat` | Red point sprites, burst pattern | 5-10 particles, spread, fade |
| Sparks (armor/shield) | `Sparks` | White/yellow point sprites | On shielded hit |
| Explosion | `Explosion` | Orange/yellow expanding sphere + points | Bomber death, destructible break |
| XP gem trail | `XPGemTrail` | Cyan point trail | Follows gem as it flies to player |
| Bullet impact (wall) | `BulletImpactWall` | Gray dust point sprites | Small burst at impact point |
| Bullet impact (enemy) | `BulletImpactEnemy` | Red flash point sprites | At hit position |
| Destructible debris (wood) | `DestructibleDebrisWood` | Brown point sprites | On crate break |
| Destructible debris (stone) | `DestructibleDebrisStone` | Gray point sprites | On pillar break |
| Destructible debris (metal) | `DestructibleDebrisMetal` | Silver point sprites | On barrel break |
| Damage numbers | (rendered separately) | Canvas-generated text sprites | White normal, yellow crit |

## Sound Effects

All sounds start as generated tones. Format: WebM or OGG (with MP3 fallback). Loaded through Howler.js. Sound manifest schema defined in config.md.

| Asset | SoundId | Placeholder | Category |
|-------|---------|-------------|----------|
| Pistol fire | `PistolFire` | Short high sine pop (800Hz, 50ms) | weapon |
| SMG fire | `SMGFire` | Short mid click (600Hz, 30ms) | weapon |
| Assault Rifle fire | `AssaultRifleFire` | Mid sharp crack (500Hz, 40ms) | weapon |
| Shotgun fire | `ShotgunFire` | Low boom (200Hz, 80ms) | weapon |
| LMG fire | `LMGFire` | Low thud (300Hz, 60ms) | weapon |
| Reload | `Reload` | Click-clack sequence (two tones) | weapon |
| Empty clip click | `EmptyClipClick` | Short dry click (1000Hz, 20ms) | weapon |
| Player footstep | `Footstep` | Soft low tap (100Hz, 30ms) | player |
| Dodge roll whoosh | `DodgeRollWhoosh` | Noise burst, 200ms fade | player |
| Player hit grunt | `PlayerHitGrunt` | Low tone drop (300→200Hz, 100ms) | player |
| Player death | `PlayerDeath` | Descending tone (400→100Hz, 500ms) | player |
| Enemy hit (flesh) | `EnemyHitFlesh` | Wet thud (250Hz, 40ms) | enemy |
| Enemy hit (armor) | `EnemyHitArmor` | Metallic ping (800Hz, 30ms) | enemy |
| Enemy death | `EnemyDeath` | Short crunch (noise, 100ms) | enemy |
| Knife swing | `KnifeSwing` | Whoosh (high noise, 80ms) | enemy |
| Enemy gunshot | `EnemyGunshot` | Sharp crack (700Hz, 35ms) | enemy |
| Explosion | `Explosion` | Low boom + noise (100Hz + noise, 300ms) | enemy |
| XP gem pickup | `XPGemPickup` | High chime (1200Hz, 60ms) | pickup |
| Health pickup | `HealthPickup` | Ascending chord (400→800Hz, 200ms) | pickup |
| Currency pickup | `CurrencyPickup` | High metallic clink (2000Hz, 40ms) | pickup |
| Gun pickup | `GunPickup` | Heavy equip thunk (200Hz, 100ms) | pickup |
| Menu click | `MenuClick` | UI click (1000Hz, 20ms) | ui |
| Menu hover | `MenuHover` | Soft UI blip (1200Hz, 15ms) | ui |
| Comparison screen open | `ComparisonScreenOpen` | Slide sound (noise sweep, 150ms) | ui |
| Gun swap confirm | `GunSwapConfirm` | Confirmation ding (800Hz, 100ms) | ui |
| Level-up notification | `LevelUpNotification` | Alert ding (1000Hz, 150ms) | ui |
| Upgrade spent | `UpgradeSpent` | Ascending confirm (600→1000Hz, 100ms) | ui |
| Pause | `Pause` | Low tone (300Hz, 80ms) | ui |
| Unpause | `Unpause` | High tone (600Hz, 80ms) | ui |
| Chest open | `ChestOpen` | Creak + chime (noise sweep + high tone, 250ms) | environment |
| Door open | `DoorOpen` | Creak/slide (noise sweep low, 200ms) | environment |
| Destructible break (wood) | `DestructibleBreakWood` | Crunch (noise burst, 100ms) | environment |
| Destructible break (stone) | `DestructibleBreakStone` | Heavy crunch (low noise, 150ms) | environment |
| Destructible break (metal) | `DestructibleBreakMetal` | Metallic crash (mid noise, 120ms) | environment |
| Fire ambient | `FireAmbient` | Crackle loop (filtered noise) | environment |
| Water ambient | `WaterAmbient` | Gentle flow loop (filtered noise) | environment |

**Looping sounds:** `FireAmbient` and `WaterAmbient` must have `loop: true` in the sound manifest. Placeholders for looping sounds should be seamlessly loopable waveforms (continuous filtered noise, not a burst).

**v1 sound simplifications:** The GDD mentions per-gun-type reload sounds and per-enemy-type death sounds. v1 uses a single generic `Reload` sound and a single generic `EnemyDeath` sound. Per-type variants are a post-v1 polish task.

## UI Assets

All UI is React + HTML/CSS. No image assets needed for v1 — everything is styled with CSS.

| Element | Implementation |
|---------|---------------|
| Health bar | CSS div with width% fill, red gradient |
| Armor bar | CSS div, blue gradient |
| Shield bar | CSS div, cyan gradient |
| Gun display (active) | CSS border + gun name text + ammo count |
| Gun display (inactive) | CSS border (dimmed) + gun name text |
| Upgrade indicator | CSS pulsing dot/glow |
| Crosshair | CSS circle + cross lines, fixed center overlay |
| Damage numbers | Canvas-generated Three.js sprites |
| Loading screen | CSS centered text + spinner |
| Main menu | React component, CSS styled |
| Weapon select screen | React component, CSS grid with gun cards |
| Gun comparison screen | React component, CSS grid layout, side-by-side |
| Gun upgrade menu | React component, CSS styled trait list |
| Forced upgrade screen | React component (same as upgrade, dismiss blocked) |
| Pause overlay | React component, semi-transparent backdrop + buttons |
| Death screen | React component, CSS styled stats display |
| Victory screen | React component, CSS styled stats + victory message |
| Settings screen | React component, CSS sliders and toggles |
| Shop UI | React component, item list with prices |

## Gun Icons

For HUD and menus, gun "icons" are text labels with colored backgrounds in v1. No sprite images.

| Gun | Label | Color |
|-----|-------|-------|
| Pistol | "PST" | Gray |
| SMG | "SMG" | Light blue |
| Assault Rifle | "AR" | Green |
| Shotgun | "SG" | Orange |
| LMG | "LMG" | Dark red |

## Data Files

| File | Format | Contents |
|------|--------|----------|
| `config/design-params.json` | JSON | All tunable game parameters |
| `config/sound-manifest.json` | JSON | SoundId enum → file path + playback settings (schema in config.md) |
| `config/particle-manifest.json` | JSON | ParticleEffect enum → spawn settings (schema in config.md) |

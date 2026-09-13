## What a wipe means

A wipe in Rust means clearing player progress and starting over. It is how the game works: Facepunch ships an update on the **first Thursday of every month**, every large server wipes that day, and some servers wipe weekly on top of that.

A wipe is not a fault or a punishment — it is what keeps a server alive. Without it the map fills with abandoned bases within two months and nobody can build.

> [!note] Put your wipe day in the server description from the settings tab. Players read the description before they join, and it is the first thing they look for.

@[open](panel:settings)

## Two kinds of wipe

**Map wipe**: the map and everything built on it are deleted and your server generates a new map. The blueprints players unlocked stay with them, so they rebuild fast. This is the usual monthly wipe.

**Full wipe**: everything goes — the map, the buildings, the blueprints and the player data. Everyone starts from a rock. Most servers do this every two or three months, or when they first open.

## How to run one

The **Controls** tab has a wipe section with two buttons.

1. Pick the kind of wipe and read the confirmation
2. We warn the players who are online and stop your server
3. With the server stopped, and before anything is deleted, we take a backup ourselves, listed in your backups as "Before the content change"
4. We clear it, and it comes back on its own with a new map only if it was running

A wipe is only undone from that backup, so keep it until you are sure everything is fine.

@[open](backups)

> [!note] If your backup storage is full, the wipe does not start. Delete an old backup and try again.

> [!danger] A wipe deletes work players put real hours into. Announce it in your Discord at least a day ahead, and be exact: which wipe, and when.

## Want a specific map?

If you like a map, pin the **seed** and the **world size** in the settings tab before the wipe and you get the same map back exactly. If you want a fresh map every month, change the seed to any number before you wipe.

@[open](panel:settings)

> [!warning] Changing the seed or the world size on its own builds a new map on the next restart, even without pressing a wipe button — it just does not clear player data.

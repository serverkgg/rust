## Create your server

From the **Create a server** page pick Rust. The game is heavy — 16GB is the comfortable experience, and we do not recommend going below 8GB.

After payment your machine starts provisioning, and you can follow its progress on the order page. There is nothing to set up: as soon as the machine is ready your server downloads the latest Rust build from Steam and starts on its own.

> [!note] The first install takes a while — the download is close to 7GB, and after it the server generates the map from your seed. Watch all of it from the console tab.

@[open](console)

## Join the game

:::when server.address
Copy your address:

@[field](server.address)

Then inside Rust:

1. From the main menu press **F1** to open the console
2. Type `client.connect` then a space then the address exactly as shown
3. Press Enter and you are in

:::else
Your server is still setting up, so it has no address yet — it appears here the moment the install finishes and the map is built.
:::

> [!note] The server needs no Steam login and nothing extra to buy. Players need a copy of Rust; the server runs on its own.

## Make yourself admin

To unlock the admin commands in game, your Steam ID has to be in the admin file.

1. Get your SteamID64 from `steamid.io` or from your profile link
2. Open `server/serverk/cfg/users.cfg` in the file manager
3. Add a line: `ownerid 76561198000000000 "your name" "owner"`
4. Restart your server

@[open](files:server/serverk/cfg/users.cfg)

After that **F1** in game gives you the full admin console.

## Your first week

- The name, description, player slots, world size and seed all live in the settings tab, and every change needs a restart
- Your server keeps running with nobody online — player bases decay unless somebody pays their upkeep
- Your map is safe: we take automatic backups, and you can take one yourself before any wipe
- Rust patches on the first Thursday of every month, and your server pulls the newest Steam build every time it starts

@[open](backups)

> [!warning] After a big Facepunch update, players cannot join until your server runs the same build. A restart is all it takes.

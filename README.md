# EExLCC KubeJS Utils

KubeJS scripts and assets for the EExLCC Cobblemon server.

## Gift Balls

Each ball has its own empty item, for example `kubejs:great_gift_ball` and
`kubejs:myth_gift_ball`. Craft it with two Link Cables around the matching ball
(`LBL`). The catalogue in `startup_scripts/gift_balls.js` covers all 48 Cobblemon
balls and Fai's Myth Ball. Empty gifts are unstackable so filling one replaces
exactly one item.

Filled gifts retain their Pokémon preview and detailed tooltip. They remember
the empty gift's variety and change the Pokémon's caught ball to that variety
when received. Old generic Gift Balls remain usable and preserve the Pokémon's
original ball.

Place icons in `assets/kubejs/textures/item/gift_ball/<variety>_gift_ball.png`,
for example `great_gift_ball.png` or `myth_gift_ball.png`. Missing icons inherit
`assets/kubejs/models/item/strange_gift_ball.json`. Drop in a matching PNG and
reload client resources with F3+T; no script or model edits are needed. The
fallback is selected again if an icon is removed.

Item model JSON files for the current icons are included in `assets/kubejs/models/item/`
so KubeJS Sync deploys the texture references together with the PNGs. The final
client asset stage in `client_scripts/gift_ball_assets.js` refreshes those models
after asset deployment, including new icons and removals.

Let KubeJS Sync deploy the startup scripts, client scripts, and assets. Restart
both client and server once when adding new item IDs. Later icon additions only
need syncing and a client resource reload.

Run the transfer and icon fallback checks with `node tests/gift_ball.test.cjs`.

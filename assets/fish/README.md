# Fish sprites for Reel Legends GFX

Drop a PNG named after the fish id into this folder (e.g. `mosquitofish.png`) and the game uses it
instead of the code-drawn fish. No file = the old code-drawn fish still shows, so you can do a few at a time.

Rules for each PNG
- Head faces RIGHT, fish centred, transparent background
- Same shape/aspect as the guide in `_guides/<id>.png` (1024 px wide; use the guide as the img2img / ControlNet reference so proportions match)
- Golden / albino variants are made from your sprite automatically (colour filter), so draw only the normal colours
- Names, biomes, tiers and colours for every fish: `fish-list.json`

ComfyUI idea: guide PNG -> ControlNet (canny/lineart) or img2img at ~0.55 denoise, prompt like
"<name>, side view, facing right, stylized game sprite, clean outline, soft shading, transparent background",
then remove the background (rembg) and save as `<id>.png`.

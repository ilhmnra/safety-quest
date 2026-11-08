# Safety Quest · The Training Works

A first-person voxel factory and interactive portfolio by Aulia Ilham Nur Alfian. [Play on GitHub Pages](https://ilhmnra.github.io/safety-quest/).

## Run locally

```sh
npm ci
npm run dev
```

On a touchscreen, tap ground or an object to walk there and drag to look. On a laptop, use WASD, drag or use the arrow keys to look, and press F to interact. Click the control mode in the top bar for optional pointer lock. Settings offer Q/E for horizontal look, with Up and Down for pitch. Press C or tap the clipboard icon once you've picked up the clipboard. Esc opens the pause menu or closes the active panel.

Look down both lanes at the zebra crossing and wait for “Road clear. Cross now.” Follow the floor dots to the clipboard beside the PPE cabinet. Inspect and wear the required PPE, pick up the tag, and record your press inspections directly on the clipboard. The workstation receives mail after both press exercises. The professional portfolio and original résumé are also available from the main menu.

The factory is continuous. The office is a separate set used only during cinematics. These are fictional training exercises. Real servicing requires authorized lockout/tagout and site-specific procedures.

## Test and publish

```sh
npm test
npm run build
```

Tests cover movement, road lane and cue timing, gaze, PPE and tag state, machine operation, and ending priority. The GitHub Pages workflow runs the tests and publishes `dist/` from `main`. URLs are relative so assets work under `/safety-quest/`.

## Audio

- [Truck air horn recording by goose278](https://freesound.org/people/goose278/sounds/174819/), bundled from the [CC0 source](https://creativecommons.org/publicdomain/zero/1.0/). Playback uses an excerpt with a short fade and directional panning.
- “You've got mail!” was synthesized for this project with an English Windows System.Speech voice. The other effects and ending music are synthesized in the browser.

## References

- [Jordan Chavis’s interactive café](https://www.jordanchavis.io/)
- [Aulia Ilham’s portfolio](https://ilhmnra.github.io/) and [published source](https://github.com/ilhmnra/ilhmnra.github.io)
- [Original résumé PDF in the portfolio source](https://github.com/ilhmnra/ilhmnra.github.io/blob/HEAD/assets/Aulia-Ilham-Resume.pdf)
- [OSHA control of hazardous energy](https://www.osha.gov/control-hazardous-energy)


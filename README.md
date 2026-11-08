# Safety Quest · The Training Works

An explorable first-person voxel factory and professional portfolio by Aulia Ilham Nur Alfian. The forecourt, training bay, and operations office occupy one continuous Three.js world.

## Run locally

```sh
npm ci
npm run dev
```

On a portrait touchscreen, tap a patch of ground, object, or glowing marker to walk. Tap the ground again to stop, and drag the view to look around. On desktop, click the canvas to capture the mouse, use WASD to walk, E to interact, and Esc to pause. The pause menu also opens the portfolio, résumé, and settings.

Cross at the zebra stripes after checking both directions. Walk inside, equip the posted PPE, and inspect the presses in either order. Report Press A's defect and complete a simulated operating cycle and shutdown on Press B. The workstation receives mail after both tasks. The original résumé is bundled with the virtual personnel directory.

All training events are fictional. Real servicing requires authorized lockout/tagout and site-specific procedures.

## Publish to GitHub Pages

The built site uses relative asset URLs and is designed for the `/safety-quest/` repository subpath. The repository is separate from the existing `ilhmnra.github.io` portfolio.

1. Authenticate GitHub CLI as `ilhmnra` and verify the active account.

   ```sh
   gh auth login --hostname github.com --web
   gh api user --jq .login
   ```

2. From the local repository, create and push the dedicated public repository. If using the source ZIP, run `git init -b main`, `git add .`, and `git commit -m "Build Safety Quest"` first.

   ```sh
   gh repo create ilhmnra/safety-quest --public --source . --remote origin --push
   ```

3. In the new repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. From **Actions → Deploy Safety Quest**, select **Run workflow** on `main`.

4. After the deployment job succeeds, open [the project URL](https://ilhmnra.github.io/safety-quest/) and verify that the world and PDF open.

Run `npm run build` for the TypeScript check and production bundle. The deploy workflow publishes `dist/`.

## Verification

The TypeScript check and production build passed. Chromium exercised the production site under the repository subpath, with touch-only walkthroughs at 360 × 800, 390 × 844, and 430 × 932. Coverage included the crossing outcomes, seamless entry, PPE correction, both presses in both orders, unsafe operation and recovery, both mail outcomes, all portfolio tabs, the original PDF, and persistence after reload. A separate desktop run covered pointer lock, mouse look, WASD, E, Esc, and the off-crossing failure. Movement regression checks covered 288 routes at different frame timings and walking into the office.

GitHub publishing requires a valid session for the target account. The existing portfolio repository is separate.

## References

- [Jordan Chavis’s interactive café](https://www.jordanchavis.io/)
- [Aulia Ilham’s portfolio](https://ilhmnra.github.io/) and [published source](https://github.com/ilhmnra/ilhmnra.github.io)
- [Original résumé PDF in the portfolio source](https://github.com/ilhmnra/ilhmnra.github.io/blob/HEAD/assets/Aulia-Ilham-Resume.pdf)
- [GitHub Pages publishing source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [OSHA control of hazardous energy](https://www.osha.gov/control-hazardous-energy)


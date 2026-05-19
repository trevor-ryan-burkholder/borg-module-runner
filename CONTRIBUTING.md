# Contributing an Adventure

The Module Runner has no backend, so community submissions happen by pull request to this repo.

## Three ways to share an adventure

**1. Just a share link.** Open the runner, build or load your adventure, hit **share**, send the URL. No PR, no review, no permanence. The whole adventure rides in the URL hash. Best for one-shots, playtest links, and quick handoffs.

**2. Drop the .json into someone else's library.** Anyone with the file can use the runner's **library → upload** to load it. Best for groups, conventions, and zines.

**3. Submit it to the bundled registry (this guide).** Permanent, browsable from the picker, distributed with the app. PR required.

## Submission requirements

Adventures bundled into the runner must:

1. Be original content, or be published under the **MÖRK BORG Third Party License** (Mörk Borg / Ronin Borg) with full attribution. The runner does not host third-party commercial modules.
2. Pass `validateAdventure` cleanly (run the builder, paste your JSON in, look for the green ✓).
3. Include in `meta`: `id`, `title`, `author`, `system`, `description`, `startNode`, `license`.
4. Use kebab-case `id` matching the filename: `the-bone-orchard` → `the-bone-orchard.json`.
5. Be playable end-to-end at the table. Stubs and starters are welcome — say so in the description.

## How to submit

1. Fork the repo.
2. Add your adventure JSON to `src/data/<your-id>.json`.
3. Register it in `src/data/adventures-registry.json` under the `community` array:

   ```json
   {
     "id": "the-bone-orchard",
     "title": "The Bone Orchard",
     "system": "morkborg",
     "author": "Your Name",
     "description": "One-line description.",
     "file": "the-bone-orchard.json"
   }
   ```

4. Import it in `src/utils/loadAdventure.js`:

   ```js
   import boneOrchard from '../data/the-bone-orchard.json';

   const BUNDLED = {
     'graves-left-wanting': gravesLeftWanting,
     'ronin-borg-starter': roninBorgStarter,
     'the-bone-orchard': boneOrchard,
   };
   ```

5. Open a PR. Include in the description: how long the adventure runs, party size assumed, content warnings if relevant, and a link to one playtest report or a one-paragraph synopsis of how it played at your table.

## Style guide

- Write in Mörk Borg's voice — bleak, weird, fragmented. See the project root `CLAUDE.md` for tone notes.
- Read-aloud blocks should be readable cold. Italics-of-the-soul are fine; purple prose is not.
- Every node needs at least one exit OR be tagged `end`.
- Locked exits need a `condition` string the GM can read at the table.
- Mark canon-uncertain claims `[CANON CHECK]` in `gm_notes`.

## Maintenance

The community registry is curated. The maintainers reserve the right to reject submissions that don't meet the requirements above, or remove bundled adventures whose authorship turns out to be misattributed. No appeals process — open an issue if you disagree.

If your PR is rejected, the share-link and .json file routes are still open to you. Nothing in this repo gatekeeps your ability to share an adventure with another GM.

# Contributing to ZoreWars

Thanks for helping! Bug fixes, new warriors, docs, tutorials and ideas for the 3D battlefield are all welcome.

## Getting started

```bash
npm install
npm start            # the arena at http://localhost:8080
npm test             # the test suite (Python 3 on PATH enables the Python tests)
```

- **Engine changes** (`src/engine/`): run `npm test`. If you change instruction semantics, the assembler or placement, also run the pMARS comparison (`npm run compare -- --pmars path/to/pmars`, see COMPLIANCE.md). The classic ruleset must keep matching pMARS.
- **New warriors**: add the file to `warriors/`, an entry to `warriors/index.json` (with the same `family` as its card) and a card to `warriors/encyclopedia.json`; the tests check that every library warrior has a card and that no two entries have the same code unless one is marked `convertedFrom` or `sameAs`. Run `node scripts/convert-library.js` to regenerate the JavaScript and Python versions, and `node scripts/benchmark.js` to update the rankings.
- **The code editor** is CodeMirror 6, bundled into `web/vendor/codemirror.js` so the site needs no build step. After changing the pinned `@codemirror/*` versions in `package.json`, run `npm run build:editor` and commit the result. Editor integration (Redcode mode, autocomplete, help) is in `web/editor.js`.
- **The 3D Avatars view** uses three.js, bundled the same way into `web/vendor/three.js` (only what `scripts/three-entry.js` lists, so add anything new from three.js there). After changing the pinned `three` version or the entry, run `npm run build:three` and commit the result. The arena loads it only when the Avatars view opens.
- **Docs**: the tutorial is `web/docs.html` and the encyclopedia is `web/warriors.html` with its data in `warriors/encyclopedia.json`.

## Licenses of contributions

- **Code** is licensed under Apache-2.0 (LICENSE). Contributors keep their copyright.
- **Warriors** you add to the library are dedicated to the public domain under CC0 1.0 (warriors/LICENSE.md).
- **Documentation text** is licensed under CC BY 4.0.

Please don't submit code copied or translated from GPL projects such as pMARS, or warriors you didn't write without their author's permission. ZoreWars uses pMARS only as an external program to check compatibility.

## Sign your commits (DCO)

ZoreWars uses the [Developer Certificate of Origin](https://developercertificate.org/) instead of a contributor license agreement. Each commit must end with a sign-off line certifying that you wrote the change, or have the right to submit it, under the project's licenses:

```
Signed-off-by: Your Name <you@example.com>
```

`git commit -s` adds it for you, using your git `user.name` and `user.email`. A check on every pull request flags commits without one. To fix your last commit, run `git commit --amend -s`. For several commits, run `git rebase --signoff main`.

The certificate you agree to by signing off:

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

## Trademark

The ZoreWars name and logo aren't covered by the code or content licenses. Forks are welcome, but please give yours a different name.

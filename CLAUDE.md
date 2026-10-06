# topic_overview

The page in `packages/web` is written against **Solid 2.0**, a release candidate, not Solid 1.x. Code from memory of 1.x is wrong in ways that still compile. Before writing or changing Solid code, read `packages/web/node_modules/solid-js/CHEATSHEET.md`, and its section "What changed from 1.x" in particular. It ships with the installed version, so it always matches it.

For depth the cheatsheet does not give, read the migration guide and the design documents in Solid's repository, under `documentation/solid-2.0/`. They describe 2.0 as it is developed, which can be ahead of the pinned version.

Every dependency is pinned to an exact version and upgraded on purpose, never through a range.

---
title: Drizzle ORM with Effect-TS — Integration Lines, Versions, and Which to Pick
category: technology
tags: [effect, effect-v4, effect-v3, drizzle, orm, typescript, postgres, sql, layers, services]
status: complete
created: 2026-10-17
updated: 2026-10-17
sources:
  - https://orm.drizzle.team/docs/connect-effect-postgres
  - https://orm.drizzle.team/docs/get-started/effect-postgresql-new
  - https://orm.drizzle.team/docs/sqlite/effect-schema
  - https://github.com/drizzle-team/drizzle-orm/issues/5414
  - https://api.github.com/repos/drizzle-team/drizzle-orm/issues/5414/comments
  - https://github.com/Effect-TS/effect/issues/3796
  - https://effect.website/docs/v3/api/sql-drizzle
  - https://effect.website/docs/v3/api/sql-drizzle/Pg
  - https://effect.website/blog/releases/effect/40
  - https://effect.website/blog/this-week-in-effect/138
  - https://registry.npmjs.org/-/package/drizzle-orm/dist-tags
  - https://registry.npmjs.org/-/package/effect/dist-tags
  - https://registry.npmjs.org/-/package/@effect/sql-pg/dist-tags
  - https://registry.npmjs.org/-/package/@effect/sql-drizzle/dist-tags
  - https://registry.npmjs.org/@effect/sql-drizzle/latest
  - https://unpkg.com/drizzle-orm@1.0.0-rc.4/package.json
  - https://unpkg.com/@effect/sql-pg@4.0.5/package.json
  - https://www.effect-mq.com/storage/postgres
  - https://www.npmjs.com/package/@handfish/drizzle-effect
  - https://x.com/DrizzleORM
  - https://www.reddit.com/r/effect/comments/1wdm42g/effect_v4_drizzlekysely_support/
confidence: high
---

# Drizzle ORM with Effect-TS — Integration Lines, Versions, and Which to Pick

## TL;DR

- **Yes.** As of 2026-10-17 there are two independent, maintained integration lines, and you pick by *version pair*, not by preference: Drizzle-owned drivers for **Effect v4 + drizzle-orm 1.0 RC**, and Effect-owned `@effect/sql-drizzle` for **Effect v3 + drizzle-orm 0.4x**.
- The Drizzle-owned line is the current one: `drizzle-orm/effect-postgres` and friends ship in `drizzle-orm@1.0.0-rc.4`, peer on `@effect/sql-*` **v4**, and have official docs ([`connect-effect-postgres`](https://orm.drizzle.team/docs/connect-effect-postgres)).
- The Effect-owned line is the v3 module: `@effect/sql-drizzle@0.51.0` peers `effect ^3.22.0` and `drizzle-orm >=0.43.1 <0.50`, and has only an API reference — the docs gap was [written up in 2024](https://github.com/Effect-TS/effect/issues/3796) and closed as stale in July 2026 with the gap still open.
- **The two do not cross:** `@effect/sql-drizzle` excludes both Effect 4.x and drizzle >= 0.50; Drizzle's Effect drivers require the 1.0 RC line. Using Drizzle's Effect support today means running `drizzle-orm@rc` alongside stable [Effect 4.0](https://effect.website/blog/releases/effect/40) (released 2026-09-30).

## Context

Question asked 2026-10-17: *can Drizzle be used with effect-ts?* The repo already holds Effect v4 research ([Effect v4 @effect/rpc](./effect-v4-rpc.md), [Effect v4 primitives](../reference/effect-v4-primitives.md), [Effect v4 production error handling](../howto/effect-v4-production-error-handling.md)), so this file fixes the Drizzle side of that picture: which package to install, which Effect version it targets, and what is still missing.

## Findings

### 1. The two integration lines

Compared items across columns, dimensions down rows:

| | Drizzle-owned: `drizzle-orm/effect-*` | Effect-owned: `@effect/sql-drizzle` |
|---|---|---|
| Owner | drizzle-team (in the drizzle-orm package) | Effect team (`packages/sql-drizzle`) |
| Effect target | v4 (`@effect/sql-*` `>=4.0.0-beta.83 \|\| >=4.0.0`) | v3 (`effect ^3.22.0`) |
| drizzle-orm range | 1.0 RC line (`1.0.0-rc.4` current) | `>=0.43.1 <0.50` |
| Ships as | subpath exports of `drizzle-orm` | separate package, `@effect/sql-drizzle@0.51.0` |
| Dialects | pg, mysql2, pglite, sqlite (node/bun/DO/wasm), d1, libsql | Pg, Mysql, Sqlite modules |
| Docs | Official guides on orm.drizzle.team | API reference only; no website prose |
| Schema generation | `drizzle-orm/effect-schema` | none |
| Status | Current line; still 1.0 RC | Maintenance of the v3 pairing |

Sources: [drizzle-orm dist-tags](https://registry.npmjs.org/-/package/drizzle-orm/dist-tags), [drizzle-orm@1.0.0-rc.4 package.json](https://unpkg.com/drizzle-orm@1.0.0-rc.4/package.json), [@effect/sql-drizzle@0.51.0](https://registry.npmjs.org/@effect/sql-drizzle/latest). "Maintenance" for the v3 side is the Effect team's own framing: a Drizzle issue comment reports the Effect team saying Drizzle should target v4 "considering they already maintain a v3 drizzle module", and that v3 "only receives bugfixes from now on" ([drizzle-orm#5414 comments, 2026-03-18](https://api.github.com/repos/drizzle-team/drizzle-orm/issues/5414/comments)).

### 2. Path A — Drizzle-owned Effect drivers (Effect v4 + drizzle-orm 1.0 RC)

**What ships.** `drizzle-orm@1.0.0-rc.4` exposes at least these Effect entry points: `drizzle-orm/effect-core`, `effect-postgres`, `effect-mysql2`, `effect-pglite`, `effect-sqlite-node`, `effect-sqlite-bun`, `effect-sqlite-do`, `effect-d1`, `effect-libsql`, and `effect-schema` ([package.json exports](https://unpkg.com/drizzle-orm@1.0.0-rc.4/package.json), fetched 2026-10-17).

**Peer ranges pin the pairing.** Every `@effect/sql-*` driver peer is `>=4.0.0-beta.83 || >=4.0.0`: `@effect/sql-pg`, `-mysql2`, `-pglite`, `-sqlite-node`, `-sqlite-bun`, `-sqlite-do`, `-sqlite-wasm`, `-d1`, `-libsql` ([same package.json](https://unpkg.com/drizzle-orm@1.0.0-rc.4/package.json)). The v4 SQL *core* lives inside `effect` itself — `@effect/sql` has no 4.x dist-tag (latest stays `0.52.1`), consistent with the v4 package merge documented in [Effect v4 @effect/rpc §1](./effect-v4-rpc.md), while dialect drivers stay separate packages ([@effect/sql-pg](https://registry.npmjs.org/-/package/@effect/sql-pg/dist-tags) peers `effect ^4.0.5`).

**Install (official docs).** `npm i drizzle-orm@rc effect @effect/sql-pg pg` plus `-D drizzle-kit@rc @types/pg` ([Get Started with Drizzle and Effect PostgreSQL](https://orm.drizzle.team/docs/get-started/effect-postgresql-new)).

**Minimal program** — the docs' quick path is `PgDrizzle.makeWithDefaults()` (no logging, no caching) inside an effect, with the connection provided as a layer ([Drizzle <> Effect Postgres](https://orm.drizzle.team/docs/connect-effect-postgres)):

```ts
import * as PgDrizzle from 'drizzle-orm/effect-postgres';
import { PgClient } from '@effect/sql-pg';
import * as Effect from 'effect/Effect';
import * as Redacted from 'effect/Redacted';
import { sql } from 'drizzle-orm';

const PgClientLive = PgClient.layer({
  url: Redacted.make(process.env.DATABASE_URL!),
});

const program = Effect.gen(function* () {
  const db = yield* PgDrizzle.makeWithDefaults();
  const result = yield* db.execute<{ id: number }>(sql`SELECT 1 as id`);
  console.log(result);
});

Effect.runPromise(program.pipe(Effect.provide(PgClientLive)));
```

The docs' version of `PgClient.layer` also overrides `types.getTypeParser` for the date/time OIDs (`1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182`) to return raw values "to let Drizzle handle parsing" — a date-parsing gotcha worth copying verbatim.

**Service pattern.** The docs' larger example builds `const dbEffect = PgDrizzle.make({ relations }).pipe(Effect.provide(PgDrizzle.DefaultServices))`, wraps it in a `Context.Tag('DB')` service via `Layer.effect`, and composes with `Layer.provideMerge(DBLive, PgClientLive)` — Effect's ordinary dependency-injection pattern, with the Drizzle instance as the service value ([same page](https://orm.drizzle.team/docs/connect-effect-postgres)).

**Logger and cache are injectable.** `PgDrizzle.makeWithDefaults()` defaults to a no-op logger; `EffectLogger.layer` logs through `Effect.log` with annotations (so queries join Effect's log/trace pipeline), and `PgDrizzle.DefaultServices` supplies the cache slot ([same page](https://orm.drizzle.team/docs/connect-effect-postgres)).

**Schema generation — `drizzle-orm/effect-schema`.** Generates select schemas for tables/views plus insert and update schemas, as Effect `Schema` values you can decode with `Schema.decodeUnknownEffect`; the documented dialect on that page is SQLite ([effect-schema docs](https://orm.drizzle.team/docs/sqlite/effect-schema)):

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/effect-schema';
import { Effect, Schema } from 'effect';

const users = sqliteTable('users', { /* ... */ });
const UserInsert = createInsertSchema(users);
const program = Effect.gen(function* () {
  const parsedUser = yield* Schema.decodeUnknownEffect(UserInsert)({ /* ... */ });
});
```

The module exists from `drizzle-orm@1.0.0-beta.15` upward ([drizzle-orm#5414 comments](https://api.github.com/repos/drizzle-team/drizzle-orm/issues/5414/comments)).

**Real-world adoption.** `effect-mq`'s Postgres store runs on "drizzle v1's Effect driver (`drizzle-orm/effect-postgres`, built on `@effect/sql-pg`; works on Node and Bun)", declares peers `drizzle-orm >=1.0.0-rc <2` and `@effect/sql-pg >=4.0.0-rc <5`, and keeps its tables inside the user's drizzle schema so `drizzle-kit generate`/migrate owns the DDL ([effect-mq Postgres store](https://www.effect-mq.com/storage/postgres), page dated 2026-08-27).

**How it got here** — dated timeline, all from [issue #5414](https://github.com/drizzle-team/drizzle-orm/issues/5414) and its [comments](https://api.github.com/repos/drizzle-team/drizzle-orm/issues/5414/comments) unless noted:

| Date | Event |
|---|---|
| 2026-03-01 | Feature request "Effect 4 Support" opened: the beta Effect-PG integration was "very smooth", but it targets v3, which is entering maintenance |
| 2026-03-18 | Effect team (relayed): Drizzle "should definitely build on v4 and not v3, considering they already maintain a v3 drizzle module" |
| 2026-03-19 | Mapping stated for 1.0: "`@effect/sql-drizzle` -> `drizzle-orm/effect-postgres` … but it's still all Effect v3 of course"; Drizzle owns the integration |
| 2026-04-20 | Interim era: users maintain LLM-generated patches for `drizzle-orm@1.0.0-beta.21` × `effect@beta.50` |
| 2026-05-01 | "Drizzle now natively supports Effect v4" (Drizzle tweet linked in-thread) |
| ~2026-09 | `drizzle-orm@1.0.0-rc.1` announced with "Effect v4 native support" ([@DrizzleORM](https://x.com/DrizzleORM), search snippet — tweet itself not fetched) |
| 2026-10-17 | `drizzle-orm@1.0.0-rc.4` is current; the issue is closed |

### 3. Path B — Effect-owned `@effect/sql-drizzle` (Effect v3 + drizzle-orm 0.4x)

**Published facts.** `@effect/sql-drizzle@0.51.0` — the only dist-tag — peers `effect ^3.22.0`, `@effect/sql ^0.52.0`, `drizzle-orm >=0.43.1 <0.50`; source lives at `packages/sql-drizzle` in the Effect repo; description "Drizzle integration for @effect/sql" ([registry](https://registry.npmjs.org/@effect/sql-drizzle/latest)). There is no v4 line of this package.

**API surface** (v3 API reference): modules `Core`, `Mysql`, `Pg`, `Sqlite`; the `Pg` module exports a `PgDrizzle` tag plus ([sql-drizzle/Pg](https://effect.website/docs/v3/api/sql-drizzle/Pg)):

```ts
declare function make<TSchema>(config?: Omit<DrizzleConfig<TSchema>, "logger">): Effect<PgRemoteDatabase<TSchema>, never, SqlClient>
declare const makeWithConfig: (config: DrizzleConfig) => Effect<PgRemoteDatabase, never, SqlClient>
declare const layer: Layer<PgDrizzle, never, SqlClient>
declare const layerWithConfig: (config: DrizzleConfig) => Layer<PgDrizzle, never, SqlClient>
```

Because the service tag and instance are the package's exports, the wiring is your own `Layer` tree over an Effect v3 `@effect/sql-pg` `PgClient` — assembled from those signatures, not copied from a guide:

```ts
import * as Pg from "@effect/sql-drizzle/Pg";
import * as PgClient from "@effect/sql-pg";
import { Layer, Redacted } from "effect";

// Pg.layer : Layer<PgDrizzle, never, SqlClient> — provide the v3 PgClient behind it
export const DbLive = Pg.layer.pipe(
  Layer.provide(PgClient.layer({ url: Redacted.make(process.env.DATABASE_URL!) }))
);
```

**Docs state.** [issue #3796](https://github.com/Effect-TS/effect/issues/3796) ("sql-drizzle is completely undocumented") was opened 2024-10-17, closed as stale on 2026-07-10; on closing, the Effect team member wrote that v3 "only receives bugfixes", the v4 codebase was about to merge, and "as we head into RC of Effect v4, we'll shift our focus to documentation … and also strive to have broader documentation coverage this time" — while the reporter noted the drizzle/SQL docs were still absent from the website. Treat the generated API reference plus the package source as the documentation.

**Community examples** exist for this pairing (e.g. a course module wiring `@effect/sql-pg` + `@effect/sql-drizzle` into "a single Layer configuration" — [typeonce.dev](https://www.typeonce.dev/course/paddle-payments-full-stack-typescript-app/server-implementation/postgres-database-with-effect-and-drizzle), search snippet only), and a third-party schema generator preceded the official one: `@handfish/drizzle-effect@0.0.17` builds Effect schemas (then `@effect/schema`) from Drizzle tables for PG/MySQL/SQLite ([npm](https://www.npmjs.com/package/@handfish/drizzle-effect), published ~2025-06, effectively superseded by `drizzle-orm/effect-schema`).

### 4. Version matrix at a glance (fetched 2026-10-17)

| Package | `latest` | Other tags | Relevant peer |
|---|---|---|---|
| `drizzle-orm` | `0.45.4` | `rc: 1.0.0-rc.4` | — |
| `effect` | `4.0.5` | `prev: 3.22.3`, `rc: 4.0.0-rc.118` | — |
| `@effect/sql-pg` | `4.0.5` | `rc: 4.0.0-rc.118`, `prev: 0.53.1` | `effect ^4.0.5` |
| `@effect/sql` | `0.52.1` | no 4.x tag | v4 SQL core lives in `effect` |
| `@effect/sql-drizzle` | `0.51.0` | none | `effect ^3.22.0`, `drizzle-orm >=0.43.1 <0.50` |

Effect 4.0 was declared stable on 2026-09-30 ([Effect 4.0 announcement](https://effect.website/blog/releases/effect/40); [This Week in Effect #138](https://effect.website/blog/this-week-in-effect/138), 2026-10-02).

### 5. Which to pick

| Situation | Choice |
|---|---|
| New project, happy on Effect 4.x | `drizzle-orm@rc` + `drizzle-orm/effect-postgres` (+ `effect-schema`); accept the RC |
| Existing Effect v3 codebase on drizzle 0.4x | `@effect/sql-drizzle`; no migration pressure, it is the maintained v3 pairing |
| On Effect v3 but want the official guide and dialect breadth | Not possible without moving to Effect v4 — the two lines do not cross |
| Need MySQL/SQLite/D1/libSQL on Effect 4.x | Driver modules exist per package exports, but docs found only for Postgres (see Open Questions) |

## Open Questions

- **When does `drizzle-orm@1.0.0` leave RC?** Only the RC line has the Effect drivers; the stable line (`0.45.4`) does not. [unverified: no dated GA announcement found]
- **Is `@effect/sql-drizzle` permanently v3-only, or will it be retargeted/deleted once drizzle v1 is stable?** Nothing published says either way; the current state is "v3 module exists, v4 integration lives in drizzle-orm". [unverified]
- **Are the non-Postgres `effect-*` driver modules officially supported or opportunistic?** Package exports and peers say they exist; guessed docs URLs for MySQL/SQLite Effect pages 404, and the only official guide found is Postgres. [unverified]
- **Reddit thread read blocked (HTTP 403 via TinyFish on both `reddit.com/.json` and `old.reddit.com`).** Its summary claims — "as of September 2026 … Effect v4 is a first-class execution target, with native Effect drivers, Effect-aware …" — are search-snippet only. [unverified beyond snippet]
- **"JIT row mappers to reduce ORM overhead to ~0"** appears only in the `v1.0.0-rc.1` announcement snippet; no benchmark read. [unverified]

## Related

- [Effect v4 @effect/rpc — Deep Dive](./effect-v4-rpc.md) — the v4 package-merge and service/stream model that Drizzle's v4 drivers slot into.
- [Effect v4 Primitives — Reference](../reference/effect-v4-primitives.md) — `Context`/`Layer`/`Schema` used by both integration lines.
- [Effect v4 in Production — Error Handling](../howto/effect-v4-production-error-handling.md) — where a Drizzle service's errors and `EffectLogger` queries land in a reporting pipeline.

## Changelog

- 2026-10-17 — created. Researched via TinyFish (`mcp__tinyfish__search` / `mcp__tinyfish__fetch_content`); version and peer-range facts read from the npm registry and unpkg `package.json` files on this date. Reddit and the X announcement could not be fetched (403 / snippet only) and are labeled accordingly.

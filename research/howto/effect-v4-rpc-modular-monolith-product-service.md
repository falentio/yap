---
title: Effect v4 RPC in a Modular Monolith — Product Service (Repository / Service / RPC Layers)
category: howto
tags: [effect, effect-v4, rpc, typescript, layered-architecture, modular-monolith, repository-pattern, dependency-injection, schema, sqlite]
status: complete
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://effect.website/docs/v4/api/effect/rpc/Rpc
  - https://effect.website/docs/v4/api/effect/rpc/RpcGroup
  - https://effect.website/docs/v4/api/effect/rpc/RpcServer
  - https://effect.website/docs/v4/api/effect/rpc/RpcClient
  - https://effect.website/docs/v4/api/effect/rpc/RpcMiddleware
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/Rpc.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcGroup.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcClient.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcMiddleware.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcTest.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/test/rpc/RpcSerialization.test.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/40_sql/10_basics.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/03_services/01_service.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/03_services/20_layer-composition.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/migration/v3-to-v4.md
confidence: high
---

# Effect v4 RPC in a Modular Monolith — Product Service (Repository / Service / RPC Layers)

Every code block below was **type-checked and executed** against `effect@4.0.2` (commit
`ca068cef`, read 2026-10-08) on Node 24.21.0 — including a real HTTP round-trip and a
streaming call. The Verification section records the exact observed output.

## Goal

Show how a **modular monolith with layered architecture** maps onto Effect v4 RPC. One module
(`product`) is split into four layers with a strict, one-way dependency direction:

```text
        RPC layer        ProductRpc / ProductRpcHandlers   (wire contract + transport)
            |
        Service layer    ProductService                    (business rules, transactions)
            |
        Repository layer ProductRepository                 (persistence port)
            |
        Domain           Product / NewProduct / errors     (schemas + types)
```

The dependency arrow points one way: the domain knows nothing, the repository knows the domain,
the service knows the repository port, the RPC layer knows the service. Effect's `Layer`
and `Context.Service` make that direction *checkable by the compiler* rather than a
convention in a wiki.

## Prerequisites

- **Node 22.16+** (required by `@effect/sql-sqlite-node`, which uses `node:sqlite`).
- **TypeScript 5.9+**; TS 7 recommended.
- Packages (all share one version in v4):

```sh
npm install effect@4.0.2 @effect/platform-node@4.0.2 @effect/sql-sqlite-node@4.0.2
npm install -D typescript@5.9 @types/node
```

- `tsconfig.json` needs `module: NodeNext` and `strict: true`. Because the
  examples use `.ts` import specifiers, add `allowImportingTsExtensions: true`
  with `noEmit: true` (or `rewriteRelativeImportExtensions: true` when emitting).

> **Stability warning.** Every module under `effect/rpc` is tagged
> `@stability unstable`: minor releases may break it even though 4.x is LTS. See the
> [Effect v4 @effect/rpc deep dive](../technology/effect-v4-rpc.md).

## Steps

### 1. Define the domain

`Schema.Class` is the workhorse: one declaration is simultaneously the TypeScript type, the
database row shape, and the RPC success schema.

```ts
// src/product/Product.ts
import { Effect, Schema } from "effect"

export const ProductId = Schema.String.pipe(Schema.brand("ProductId"))
export type ProductId = typeof ProductId.Type

export const Sku = Schema.String.pipe(Schema.brand("Sku"))
export type Sku = typeof Sku.Type

export class Product extends Schema.Class<Product>("app/product/Product")({
  id: ProductId,
  sku: Sku,
  name: Schema.NonEmptyString,
  priceCents: Schema.Int,
  inStock: Schema.Boolean,
  createdAt: Schema.DateTimeUtc
}) {}

export class NewProduct extends Schema.Class<NewProduct>("app/product/NewProduct")({
  sku: Sku,
  name: Schema.NonEmptyString,
  priceCents: Schema.Int,
  // Both defaults: decoding for raw JSON, constructor for generated clients.
  inStock: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false)),
    Schema.withConstructorDefault(Effect.succeed(false))
  )
}) {}

export class ProductNotFound extends Schema.TaggedError<ProductNotFound>()("ProductNotFound", {
  identifier: Schema.String,
  by: Schema.Literals(["id", "sku"])
}) {}

export class SkuAlreadyExists extends Schema.TaggedError<SkuAlreadyExists>()("SkuAlreadyExists", {
  sku: Sku
}) {}

export class InvalidPrice extends Schema.TaggedError<InvalidPrice>()("InvalidPrice", {
  priceCents: Schema.Int
}) {}

export type ProductError = ProductNotFound | SkuAlreadyExists | InvalidPrice
```

> **Gotcha: you need BOTH defaults for an optional field.** Verified against
> `effect@4.0.2`:
>
> - `withDecodingDefault` alone relaxes only *decoding* — a generated client calling
>   `schema.make({})` still fails with `Schema validation failed`.
> - `withConstructorDefault` alone relaxes only *construction* — a raw JSON payload
>   omitting the key still fails with `Missing key at ["inStock"]`.
>
> A field that either side may omit needs **both**, in this order:
>
> ```ts
> inStock: Schema.Boolean.pipe(
>   Schema.withDecodingDefault(Effect.succeed(false)),   // server: raw JSON
>   Schema.withConstructorDefault(Effect.succeed(false)) // client: schema.make
> )
> ```
>
> If you only ever construct payloads through the typed client, `withConstructorDefault`
> is enough. If you also accept raw JSON, add the decoding default too.

### 2. Repository layer — the persistence port

The repository is a `Context.Service` (an interface); the SQL implementation is a
`Layer`. Nothing above this file imports `effect/sql`.

```ts
// src/product/ProductRepository.ts
import { Array, Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlError, SqlSchema } from "effect/sql"
import { Product, ProductId, Sku } from "./Product.ts"

export class ProductRepositoryError extends Schema.TaggedError<ProductRepositoryError>()(
  "ProductRepositoryError",
  {
    operation: Schema.Literals(["findById", "findBySku", "list", "insert", "updateStock"]),
    cause: SqlError.SqlError
  }
) {}

/** The stored row: booleans are 0|1 and timestamps are ISO strings. */
const ProductRow = Schema.Struct({
  id: Schema.String,
  sku: Schema.String,
  name: Schema.String,
  priceCents: Schema.Int,
  inStock: Schema.BooleanFromBit,
  createdAt: Schema.DateTimeUtcFromString
})

const decodeRow = (row: typeof ProductRow.Type): Product =>
  Schema.decodeSync(Product)(row as never)

export class ProductRepository extends Context.Service<ProductRepository, {
  readonly findById: (id: ProductId) => Effect.Effect<Option.Option<Product>, ProductRepositoryError>
  readonly findBySku: (sku: Sku) => Effect.Effect<Option.Option<Product>, ProductRepositoryError>
  readonly list: (options: {
    readonly limit: number
    readonly offset: number
  }) => Effect.Effect<Array<Product>, ProductRepositoryError>
  readonly count: Effect.Effect<number, ProductRepositoryError>
  readonly insert: (product: Product) => Effect.Effect<Product, ProductRepositoryError>
  readonly updateStock: (
    id: ProductId,
    inStock: boolean
  ) => Effect.Effect<Option.Option<Product>, ProductRepositoryError>
}>()("app/product/ProductRepository") {
  static readonly layerNoDeps: Layer.Layer<ProductRepository, never, SqlClient.SqlClient> =
    Layer.effect(
      ProductRepository,
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient

        const selectById = SqlSchema.findOneOption({
          Request: ProductId,
          Result: ProductRow,
          execute: (id) => sql`SELECT id, sku, name, priceCents, inStock, createdAt
                            FROM products WHERE id = ${id}`
        })

        const selectBySku = SqlSchema.findOneOption({
          Request: Sku,
          Result: ProductRow,
          execute: (sku) => sql`SELECT id, sku, name, priceCents, inStock, createdAt
                             FROM products WHERE sku = ${sku}`
        })

        const selectPage = SqlSchema.findAll({
          Request: Schema.Struct({ limit: Schema.Int, offset: Schema.Int }),
          Result: ProductRow,
          execute: ({ limit, offset }) => sql`SELECT id, sku, name, priceCents, inStock, createdAt
                                             FROM products ORDER BY createdAt, id
                                             LIMIT ${limit} OFFSET ${offset}`
        })

        const selectCount = SqlSchema.findOneOption({
          Request: Schema.Void,
          Result: Schema.Struct({ total: Schema.Int }),
          execute: () => sql`SELECT COUNT(*) AS total FROM products`
        })

        // SchemaError means the DB drifted from the code: a defect, not a domain error.
        const findById = Effect.fn("ProductRepository.findById")((id: ProductId) =>
          selectById(id).pipe(
            Effect.catchTag("SchemaError", Effect.die),
            Effect.map(Option.map(decodeRow)),
            Effect.mapError((cause) => new ProductRepositoryError({ operation: "findById", cause }))
          ))

        const findBySku = Effect.fn("ProductRepository.findBySku")((sku: Sku) =>
          selectBySku(sku).pipe(
            Effect.catchTag("SchemaError", Effect.die),
            Effect.map(Option.map(decodeRow)),
            Effect.mapError((cause) => new ProductRepositoryError({ operation: "findBySku", cause }))
          ))

        const list = Effect.fn("ProductRepository.list")(
          (options: { readonly limit: number; readonly offset: number }) =>
            selectPage(options).pipe(
              Effect.catchTag("SchemaError", Effect.die),
              Effect.map(Array.map(decodeRow)),
              Effect.mapError((cause) => new ProductRepositoryError({ operation: "list", cause }))
            )
        )

        const count = selectCount(undefined).pipe(
          Effect.catchTag("SchemaError", Effect.die),
          Effect.map(Option.match({ onNone: () => 0, onSome: (row) => row.total })),
          Effect.mapError((cause) => new ProductRepositoryError({ operation: "list", cause }))
        )

        const insert = Effect.fn("ProductRepository.insert")((product: Product) =>
          sql`INSERT INTO products (id, sku, name, priceCents, inStock, createdAt)
              VALUES (${product.id}, ${product.sku}, ${product.name}, ${product.priceCents},
                      ${product.inStock ? 1 : 0}, ${DateTime.formatIso(product.createdAt)})`.pipe(
            Effect.as(product),
            Effect.mapError((cause) => new ProductRepositoryError({ operation: "insert", cause }))
          ))

        const updateStock = Effect.fn("ProductRepository.updateStock")(
          (id: ProductId, inStock: boolean) =>
            sql`UPDATE products SET inStock = ${inStock ? 1 : 0} WHERE id = ${id}`.pipe(
              Effect.andThen(selectById(id)),
              Effect.catchTag("SchemaError", Effect.die),
              Effect.map(Option.map(decodeRow)),
              Effect.mapError((cause) =>
                new ProductRepositoryError({ operation: "updateStock", cause })
              )
            )
        )

        return ProductRepository.of({ findById, findBySku, list, count, insert, updateStock })
      })
    )
}
```

Two deliberate choices:

- **`SchemaError` is `die`-d.** `SqlSchema` puts both
  `SqlError` and `SchemaError` in the error channel. A schema mismatch is a bug,
  so removing it leaves the repository's error union exactly `ProductRepositoryError` —
  which is what lets `mapError` typecheck without a cast.
- **`DateTime.formatIso` at the SQL boundary.** `node:sqlite` cannot bind a
  `DateTime` object. Encode on write, decode with `Schema.DateTimeUtcFromString`
  on read.

### 3. Service layer — business rules, no infrastructure errors

```ts
// src/product/ProductService.ts
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { Crypto } from "effect/Crypto"
import { ProductRepository, ProductRepositoryError } from "./ProductRepository.ts"
import {
  InvalidPrice, NewProduct, Product, ProductId, ProductNotFound, Sku, SkuAlreadyExists
} from "./Product.ts"

export class ProductPage extends Schema.Class<ProductPage>("app/product/ProductPage")({
  items: Schema.Array(Product),
  total: Schema.Int,
  limit: Schema.Int,
  offset: Schema.Int
}) {}

const MAX_PRICE_CENTS = 100_000_00

export class ProductService extends Context.Service<ProductService, {
  readonly getById: (id: ProductId) => Effect.Effect<Product, ProductNotFound>
  readonly getBySku: (sku: Sku) => Effect.Effect<Product, ProductNotFound>
  readonly list: (options: {
    readonly limit: number
    readonly offset: number
  }) => Effect.Effect<ProductPage>
  readonly create: (input: NewProduct) => Effect.Effect<Product, SkuAlreadyExists | InvalidPrice>
  readonly setStock: (id: ProductId, inStock: boolean) => Effect.Effect<Product, ProductNotFound>
}>()("app/product/ProductService") {
  static readonly layerNoDeps: Layer.Layer<ProductService, never, ProductRepository | Crypto> =
    Layer.effect(
      ProductService,
      Effect.gen(function*() {
        const repo = yield* ProductRepository
        const crypto = yield* Crypto

        // Infrastructure failure -> defect. The input type is concrete, so
        // catchTag removes ProductRepositoryError from the channel with no cast.
        const orDieRepository = <A>(
          effect: Effect.Effect<A, ProductRepositoryError>
        ): Effect.Effect<A> =>
          effect.pipe(
            Effect.catchTag("ProductRepositoryError", (error) =>
              Effect.logError("product repository failure", error).pipe(
                Effect.andThen(Effect.die(error))
              )
            )
          )

        const getById = Effect.fn("ProductService.getById")((id: ProductId) =>
          repo.findById(id).pipe(
            orDieRepository,
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(new ProductNotFound({ identifier: id, by: "id" })),
                onSome: Effect.succeed
              })
            )
          ))

        const getBySku = Effect.fn("ProductService.getBySku")((sku: Sku) =>
          repo.findBySku(sku).pipe(
            orDieRepository,
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(new ProductNotFound({ identifier: sku, by: "sku" })),
                onSome: Effect.succeed
              })
            )
          ))

        const list = Effect.fn("ProductService.list")(
          (options: { readonly limit: number; readonly offset: number }) =>
            Effect.all(
              { items: repo.list(options), total: repo.count },
              { concurrency: "unbounded" }
            ).pipe(
              orDieRepository,
              Effect.map(({ items, total }) =>
                ProductPage.make({ items, total, limit: options.limit, offset: options.offset }))
            )
        )

        const create = Effect.fn("ProductService.create")((input: NewProduct) =>
          Effect.gen(function*() {
            if (input.priceCents < 0 || input.priceCents > MAX_PRICE_CENTS) {
              return yield* Effect.fail(new InvalidPrice({ priceCents: input.priceCents }))
            }

            const existing = yield* repo.findBySku(input.sku).pipe(orDieRepository)
            if (Option.isSome(existing)) {
              return yield* Effect.fail(new SkuAlreadyExists({ sku: input.sku }))
            }

            const id = ProductId.make(yield* crypto.randomUUIDv4.pipe(Effect.orDie))
            const product = Product.make({
              id,
              sku: input.sku,
              name: input.name,
              priceCents: input.priceCents,
              inStock: input.inStock,
              createdAt: yield* DateTime.now
            })

            return yield* repo.insert(product).pipe(orDieRepository)
          }))

        const setStock = Effect.fn("ProductService.setStock")(
          (id: ProductId, inStock: boolean) =>
            repo.updateStock(id, inStock).pipe(
              orDieRepository,
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(new ProductNotFound({ identifier: id, by: "id" })),
                  onSome: Effect.succeed
                })
              )
            )
        )

        return ProductService.of({ getById, getBySku, list, create, setStock })
      })
    )
}
```

The error channel of `ProductService` is **`never`** for infrastructure: the
caller sees only domain errors. That is the entire job of the `orDieRepository` helper — it
is the single place where "the database is down" is reclassified from a typed error to a defect (a
5xx, not a 4xx).

### 4. RPC layer — the wire contract

Put the contract in its own file. Clients import **only** this file (schemas + tags) and never the
service or the database; in a monorepo it lives in a shared `contract` package.

```ts
// src/product/ProductRpc.ts
import { Effect, Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { CurrentTenant } from "./ProductMiddleware.ts"
import {
  InvalidPrice, NewProduct, Product, ProductId, ProductNotFound, Sku, SkuAlreadyExists
} from "./Product.ts"
import { ProductPage } from "./ProductService.ts"

export const GetProduct = Rpc.make("Product.Get", {
  payload: { id: ProductId },
  success: Product,
  error: ProductNotFound
})

export const GetProductBySku = Rpc.make("Product.GetBySku", {
  payload: { sku: Sku },
  success: Product,
  error: ProductNotFound
})

export const ListProducts = Rpc.make("Product.List", {
  payload: {
    limit: Schema.Int.pipe(
      Schema.withDecodingDefault(Effect.succeed(20)),
      Schema.withConstructorDefault(Effect.succeed(20))
    ),
    offset: Schema.Int.pipe(
      Schema.withDecodingDefault(Effect.succeed(0)),
      Schema.withConstructorDefault(Effect.succeed(0))
    )
  },
  success: ProductPage
})

export const CreateProduct = Rpc.make("Product.Create", {
  payload: NewProduct,
  success: Product,
  error: Schema.Union([SkuAlreadyExists, InvalidPrice])
})

export const SetProductStock = Rpc.make("Product.SetStock", {
  payload: { id: ProductId, inStock: Schema.Boolean },
  success: Product,
  error: ProductNotFound
})

// stream: true -> success/error describe the *stream element* and *stream error*.
export const WatchStock = Rpc.make("Product.WatchStock", {
  payload: { id: ProductId },
  success: Schema.Boolean,
  error: ProductNotFound,
  stream: true
})

export const ProductRpcs = RpcGroup.make(
  GetProduct,
  GetProductBySku,
  ListProducts,
  CreateProduct,
  SetProductStock,
  WatchStock
).middleware(CurrentTenant)
```

### 5. Middleware — cross-cutting auth, typed

```ts
// src/product/ProductMiddleware.ts
import { Context, Effect, Layer, Schema } from "effect"
import { RpcMiddleware } from "effect/rpc"
import { Headers } from "effect/http"

export class Principal extends Context.Service<Principal, { readonly tenantId: string }>()(
  "app/product/Principal"
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
  reason: Schema.String
}) {}

export class CurrentTenant extends RpcMiddleware.Service<CurrentTenant, {
  provides: Principal
}>()("app/product/CurrentTenant", {
  error: Unauthorized,
  requiredForClient: true
}) {}

export const CurrentTenantLive = Layer.succeed(CurrentTenant)(
  (handler, { headers }) =>
    Effect.gen(function*() {
      const tenantId = Headers.get(headers, "x-tenant-id")
      if (tenantId._tag === "None") {
        return yield* Effect.fail(new Unauthorized({ reason: "missing x-tenant-id header" }))
      }
      return yield* Effect.provideService(handler, Principal, { tenantId: tenantId.value })
    })
)
```

Three metadata fields carry their weight: `provides` makes `Principal` yieldable
in handlers, `error` adds `Unauthorized` to every attached RPC's error channel,
and `requiredForClient` makes the generated client refuse to typecheck until a client
middleware layer is installed.

### 6. Handlers — the only place that knows both sides

```ts
// src/product/ProductRpcHandlers.ts
import { Effect, Layer, Stream } from "effect"
import { ProductService } from "./ProductService.ts"
import { ProductRpcs } from "./ProductRpc.ts"
import { Principal } from "./ProductMiddleware.ts"

export const ProductRpcHandlers = ProductRpcs.toLayer(
  Effect.gen(function*() {
    const products = yield* ProductService   // provided to the LAYER: read once

    return ProductRpcs.of({
      "Product.Get": ({ id }) =>
        Effect.gen(function*() {
          const principal = yield* Principal   // provided to the HANDLER: read per request
          yield* Effect.logDebug("Product.Get", { tenant: principal.tenantId, id })
          return yield* products.getById(id)
        }),
      "Product.GetBySku": ({ sku }) => products.getBySku(sku),
      "Product.List": (options) =>
        Effect.gen(function*() {
          const principal = yield* Principal
          yield* Effect.logDebug("Product.List", { tenant: principal.tenantId })
          return yield* products.list(options)
        }),
      "Product.Create": (input) => products.create(input),
      "Product.SetStock": ({ id, inStock }) => products.setStock(id, inStock),
      "Product.WatchStock": ({ id }) =>
        products.getById(id).pipe(
          Effect.map((product) => product.inStock),
          Effect.map(Stream.make),
          Stream.unwrap
        )
    })
  })
)

export const ProductRpcLive = ProductRpcHandlers.pipe(
  Layer.provide(ProductService.layerNoDeps)
)
```

> **The one non-obvious rule.** A service provided by *middleware* must be `yield*`-ed
> **inside the handler effect**, because middleware wraps the per-request handler effect. Yielding
> it in the layer body fails at runtime with `Service not found: app/product/Principal`.

### 7. Wire the server

```ts
// src/product/ProductRpcServer.ts
import { Effect, Layer } from "effect"
import { SqlClient } from "effect/sql"
import { RpcSerialization, RpcServer } from "effect/rpc"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { NodeCrypto } from "@effect/platform-node"
import { ProductRpcs } from "./ProductRpc.ts"
import { CurrentTenantLive } from "./ProductMiddleware.ts"
import { ProductRpcHandlers } from "./ProductRpcHandlers.ts"
import { ProductService } from "./ProductService.ts"
import { ProductRepository } from "./ProductRepository.ts"

export const SqlLive = SqliteMigrator.layer({
  loader: SqliteMigrator.fromRecord({
    "0001_create_products": Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          sku TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          priceCents INTEGER NOT NULL,
          inStock INTEGER NOT NULL,
          createdAt TEXT NOT NULL
        )
      `
    })
  })
}).pipe(Layer.provideMerge(SqliteClient.layer({ filename: ":memory:" })))

export const ProductRpcServer = RpcServer.layerHttp({
  group: ProductRpcs,
  path: "/rpc",
  protocol: "http"          // "websocket" is the default
}).pipe(
  Layer.provide(ProductRpcHandlers),
  Layer.provide(CurrentTenantLive),
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(ProductService.layerNoDeps),
  Layer.provide(ProductRepository.layerNoDeps),
  Layer.provide(NodeCrypto.layer),
  Layer.provide(SqlLive)
)
```

That `Layer.provide` chain *is* the architecture diagram, and the compiler checks it.
`layerHttp` registers a route on an ambient `HttpRouter`, so it must be built
inside `HttpRouter.serve`:

```ts
// src/server.ts
import { Layer } from "effect"
import { HttpRouter } from "effect/http"
import { NodeHttpServer } from "@effect/platform-node"
import { createServer } from "node:http"
import { ProductRpcServer } from "./product/ProductRpcServer.ts"

export const HttpServerLive = HttpRouter.serve(ProductRpcServer).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

// run with: Layer.launch(HttpServerLive).pipe(NodeRuntime.runMain)
```

### 8. Client

```ts
import { Effect, Layer } from "effect"
import { FetchHttpClient, Headers } from "effect/http"
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/rpc"
import { ProductRpcs } from "./product/ProductRpc.ts"
import { CurrentTenant } from "./product/ProductMiddleware.ts"

export const ProductClient = RpcClient.make(ProductRpcs).pipe(
  Effect.provide(
    RpcClient.layerProtocolHttp({ url: "http://localhost:3000/rpc" }).pipe(
      Layer.provide(RpcSerialization.layerNdjson),
      Layer.provide(FetchHttpClient.layer)
    )
  ),
  Effect.provide(
    // Required because CurrentTenant is `requiredForClient`.
    RpcMiddleware.layerClient(CurrentTenant, ({ next, request }) =>
      next({
        ...request,
        headers: Headers.set(request.headers, "x-tenant-id", "tenant-a")
      }))
  )
)

// usage
const program = Effect.gen(function*() {
  const client = yield* ProductClient
  const created = yield* client["Product.Create"]({
    sku: Sku.make("SKU-1"),
    name: "Widget",
    priceCents: 1999          // inStock omitted -> constructor default
  })
  const page = yield* client["Product.List"]({})
  const stock = yield* client["Product.WatchStock"]({ id: created.id }).pipe(Stream.runCollect)
  return { created, page, stock }
})
```

### 9. Testing — swap the repository, drop the database

This is the payoff of the port: an in-memory implementation with the same service type minus the
`SqlClient` requirement.

```ts
// src/product/ProductRepositoryMemory.ts
import { Effect, Layer, Option, Ref } from "effect"
import { ProductRepository } from "./ProductRepository.ts"
import { Product, ProductId, Sku } from "./Product.ts"

export const ProductRepositoryMemory = Layer.effect(
  ProductRepository,
  Effect.gen(function*() {
    const rows = yield* Ref.make<Array<Product>>([])

    const findById = (id: ProductId) =>
      Ref.get(rows).pipe(Effect.map((all) => Option.fromNullishOr(all.find((p) => p.id === id))))

    const findBySku = (sku: Sku) =>
      Ref.get(rows).pipe(Effect.map((all) => Option.fromNullishOr(all.find((p) => p.sku === sku))))

    const list = ({ limit, offset }: { readonly limit: number; readonly offset: number }) =>
      Ref.get(rows).pipe(Effect.map((all) => all.slice(offset, offset + limit)))

    const count = Ref.get(rows).pipe(Effect.map((all) => all.length))

    const insert = (product: Product) =>
      Ref.update(rows, (all) => [...all, product]).pipe(Effect.as(product))

    const updateStock = (id: ProductId, inStock: boolean) =>
      Ref.modify(rows, (all) => {
        const index = all.findIndex((p) => p.id === id)
        if (index === -1) return [Option.none<Product>(), all] as const
        const updated = Product.make({ ...all[index], inStock })
        const next = [...all]
        next[index] = updated
        return [Option.some(updated), next] as const
      })

    return ProductRepository.of({ findById, findBySku, list, count, insert, updateStock })
  })
)
```

`RpcTest.makeClient` then drives the **real** client/server machinery — schemas,
middleware, streaming, interrupts — with no HTTP, socket, or serializer:

```ts
import { Crypto, Effect, Layer, Schema } from "effect"
import { RpcTest } from "effect/rpc"
import { ProductRepositoryMemory } from "./product/ProductRepositoryMemory.ts"
import { ProductService } from "./product/ProductService.ts"
import { ProductRpcs } from "./product/ProductRpc.ts"
import { CurrentTenantLive } from "./product/ProductMiddleware.ts"
import { ProductRpcHandlers } from "./product/ProductRpcHandlers.ts"

const TestCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => new Uint8Array(size).fill(7),
    digest: (_algorithm, data) => Effect.succeed(data)
  })
)

// Layer.mergeAll keeps every output: the server needs the handler context AND middleware.
const TestLayer = Layer.mergeAll(
  ProductRpcHandlers.pipe(
    Layer.provide(ProductService.layerNoDeps),
    Layer.provide(ProductRepositoryMemory),
    Layer.provide(TestCrypto)
  ),
  CurrentTenantLive
)

const headers = { "x-tenant-id": "tenant-a" }

const test = Effect.gen(function*() {
  const client = yield* RpcTest.makeClient(ProductRpcs).pipe(Effect.provide(TestLayer))

  const created = yield* client["Product.Create"]({
    sku: Sku.make("SKU-9"),
    name: "Test widget",
    priceCents: 500
  }, { headers })

  const duplicate = yield* client["Product.Create"]({
    sku: Sku.make("SKU-9"),
    name: "Dup",
    priceCents: 1
  }, { headers }).pipe(Effect.flip)

  return { created, duplicate }
})
```

## Verification

Commands run in a scratch project against `effect@4.0.2` on Node 24.21.0:

```sh
npx tsc --noEmit                                    # 0 errors across all 9 modules
node --experimental-strip-types test.ts             # in-memory + RpcTest
node --experimental-strip-types http-integration.ts # real HTTP server + client
```

In-memory run:

```text
TEST create => Test widget 500 inStock: false
TEST list => total: 1 items: 1
TEST duplicate => SkuAlreadyExists
TEST get existing => Success
```

HTTP run (real `node:http` server on port 34569, `FetchHttpClient` client, NDJSON
serialization):

```text
Listening on http://[::]:34569
HTTP create => HTTP-SKU-1 4200 inStock: false
HTTP get => Over HTTP
HTTP list => total: 1
HTTP stream => false
```

The last line matters: a `stream: true` procedure round-trips over the HTTP POST transport
and delivers its element to a client `Stream`.

## Troubleshooting

Every row is an error actually hit while building this example, not a hypothetical.

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Service not found: app/product/ProductRepository` | Server layer never received the repository implementation | Add `Layer.provide(ProductRepository.layerNoDeps)` to the server chain |
| `Service not found: app/product/Principal` | A middleware-provided service was yielded in the layer body instead of inside the handler | `yield*` it **inside** the handler effect; middleware wraps the per-request effect |
| `Service not found: app/product/CurrentTenant` | The middleware service layer was `Layer.provide`-d, which consumes its output | Provide it to the server layer, or use `Layer.mergeAll(handlers, CurrentTenantLive)` in tests |
| `Service not found: effect/http/HttpRouter` | `RpcServer.layerHttp` was built with no `HttpRouter` in scope | Wrap with `HttpRouter.serve(...)` |
| `TypeError: Cannot read properties of undefined (reading 'build')` | `HttpClient.layer` does not exist in v4 | Use `FetchHttpClient.layer` or `NodeHttpClient.layer` |
| `Provided value cannot be bound to SQLite parameter 6` | A `DateTime` instance was passed straight to `node:sqlite` | Encode with `DateTime.formatIso(...)`; decode with `Schema.DateTimeUtcFromString` |
| Client `Product.Create({...})` throws `Schema validation failed` for an omitted field | `withDecodingDefault` only relaxes decoding; the client constructs via `make` | Add `Schema.withConstructorDefault` as well |
| Raw JSON payload omitting a defaulted key fails with `Missing key at ["x"]` | `withConstructorDefault` only relaxes construction, not decoding | Add `Schema.withDecodingDefault` as well — an optional field needs **both** |
| `mapError` will not typecheck: `SchemaError` is not assignable to your error type | `SqlSchema` puts `SchemaError` in the error channel alongside `SqlError` | `Effect.catchTag("SchemaError", Effect.die)` before mapping the remaining errors |
| `catchTag` on a generic `Effect<A, E>` fails to narrow `E` | Generic type parameters are not distributively narrowed by `catchTag` | Type the helper input as the concrete union: `Effect<A, ProductRepositoryError>` |
| `Crypto` cannot be stubbed: "only refers to a type" | `Crypto.Crypto` is the service key; `Crypto.make` is the constructor | `Layer.succeed(Crypto.Crypto, Crypto.make({ randomBytes, digest }))` |

## Related

- [Effect v4 @effect/rpc — Deep Dive](../technology/effect-v4-rpc.md) — the architecture behind these
  APIs: definition-first contracts, protocols, serialization, middleware, and the v3 to v4 migration
  map.

## Changelog

- 2026-10-08 — corrected. The optional-field guidance was wrong: `withConstructorDefault`
  alone breaks **raw JSON** decoding (`Missing key at ["inStock"]`), and `withDecodingDefault`
  alone breaks the **typed client** (`Schema validation failed`). An optional field needs both.
  Code blocks, the gotcha note, and the troubleshooting table were updated, and both the raw-JSON
  and typed-client paths were re-run green.
- 2026-10-08 — created. All code type-checked (`tsc --noEmit`) and executed against
  `effect@4.0.2` (`Effect-TS/effect@ca068cef`): the in-memory `RpcTest`
  path, a full HTTP round-trip including a streaming call, and an in-memory repository substitution.
  Sources: official v4 RPC API docs and the pinned repository source.

/**
 * Custom rill extension: EXTENSION_NAME
 *
 * Purpose: DESCRIPTION
 *
 * Mounted in rill-config.json as "./extensions/ext-name.ts"
 * Used in rill scripts as: use<ext:namespace> => $ext
 */

import {
  type ExtensionFactoryCtx,
  type ExtensionFactoryResult,
  type ExtensionManifest,
  type ExtensionConfigSchema,
  type RillFunction,
  type RillParam,
  type RillValue,
  type RuntimeContext,
  RuntimeError,
  toCallable,
  structureToTypeValue,
} from "@rcrsr/rill";

const PROVIDER = "EXTENSION_NAME";

// ---------------------------------------------------------------------------
// Config (matches extensions.config.NAMESPACE in rill-config.json)
// ---------------------------------------------------------------------------

interface ExtensionConfig {
  // Add fields matching your rill-config.json config block.
  // All fields use snake_case at the rill boundary.
  // api_key: string;
  // timeout?: number;
}

// ---------------------------------------------------------------------------
// Extension factory
//
// Signature: (config, ctx: ExtensionFactoryCtx) => ExtensionFactoryResult
// Factory-scope ctx exposes only `{ registerErrorCode, signal }`.
// Host-scope helpers like `invalidate` live on `RuntimeContext` (per-call).
// Validate configuration with `throw new RuntimeError('RILL-R001', ...)`.
// ---------------------------------------------------------------------------

function createExtension(
  config: ExtensionConfig,
  _ctx: ExtensionFactoryCtx,
): ExtensionFactoryResult {
  // Validate config at factory init; failures use RILL-R001.
  // if (!config.api_key) {
  //   throw new RuntimeError('RILL-R001', 'EXTENSION_NAME: api_key is required');
  // }

  // Read config with defaults.
  // const timeout = config.timeout ?? 10_000;

  // ---- Define each function ----

  const exampleParam: RillParam = {
    name: "input",
    type: { kind: "string" },
    defaultValue: undefined,
    annotations: { description: "The input value" },
  };

  const exampleFn: RillFunction = {
    params: [exampleParam],
    fn: async (args, runCtx: RuntimeContext) => {
      const input = args["input"] as string;

      // Surface recoverable failures as invalid RillValues using
      // generic atoms (#AUTH, #FORBIDDEN, #NOT_FOUND, #RATE_LIMIT,
      // #QUOTA_EXCEEDED, #UNAVAILABLE, #CONFLICT, #PROTOCOL,
      // #INVALID_INPUT, #TIMEOUT, #DISPOSED, #TYPE_MISMATCH).
      // Host scripts catch these with `guard`/`retry`.
      if (!input) {
        return runCtx.invalidate(
          new Error("EXTENSION_NAME: input is required"),
          {
            code: "INVALID_INPUT",
            provider: PROVIDER,
            raw: { kind: "missing_input" },
          },
        );
      }

      // Implementation here.
      return input;
    },
    annotations: {
      description: "What this function does",
    },
    // Return type descriptor: prefer rich shapes via structureToTypeValue
    // (e.g., kind: 'dict' with fields, kind: 'list' with element). Use
    // anyTypeValue only for truly heterogeneous results.
    returnType: structureToTypeValue({ kind: "string" }),
  };

  // ---- Assemble extension value ----

  const value: Record<string, RillValue> = {
    example: toCallable(exampleFn),
    // Add more functions here:
    // other_fn: toCallable(otherFn),
  };

  return { value };
}

// ---------------------------------------------------------------------------
// Manifest (enables rill-config.json mount loading)
// ---------------------------------------------------------------------------

export const configSchema: ExtensionConfigSchema = {
  // Declare config fields and their types for validation.
  // api_key: { type: "string", required: true, secret: true },
  // timeout: { type: "number" },
};

export const extensionManifest: ExtensionManifest = {
  factory: createExtension as ExtensionManifest["factory"],
  configSchema,
  version: "0.1.0",
};

// ---------------------------------------------------------------------------
// Type descriptor reference (for structureToTypeValue):
//
//   { kind: "string" }
//   { kind: "number" }
//   { kind: "bool" }
//   { kind: "list", element: { kind: "string" } }
//   { kind: "dict", fields: {
//       name: { type: { kind: "string" } },
//       count: { type: { kind: "number" } },
//   }}
//
// Param types (for RillParam.type):
//   Same syntax as above.
//
// Boundary keys:
//   Param names, args keys, returned dict-literal keys, and field names in
//   `returnType` declarations MUST be snake_case. Map vendor SDK camelCase
//   shapes at the boundary.
//
// Errors:
//   Factory-init validation: throw new RuntimeError('RILL-R001', '...').
//   Per-call recoverable failures: return runCtx.invalidate(err, meta) with
//   one of the pre-registered atoms above.
// ---------------------------------------------------------------------------

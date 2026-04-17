/**
 * Custom rill extension: EXTENSION_NAME
 *
 * Purpose: DESCRIPTION
 *
 * Mounted in rill-config.json as "./dist/extensions/ext-name.js"
 * Used in rill scripts as: use<ext:namespace> => $ext
 */

import {
  type ExtensionFactoryResult,
  type ExtensionManifest,
  type ExtensionConfigSchema,
  type RillParam,
  type RillFunction,
  type RillValue,
  RuntimeError,
  toCallable,
  structureToTypeValue,
} from "@rcrsr/rill";

// ---------------------------------------------------------------------------
// Config (matches extensions.config.NAMESPACE in rill-config.json)
// ---------------------------------------------------------------------------

interface ExtensionConfig {
  // Add fields matching your rill-config.json config block
  // api_key: string;
  // timeout?: number;
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

function createExtension(config: ExtensionConfig): ExtensionFactoryResult {
  // Read config with defaults
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
    fn: async (args) => {
      const input = args["input"] as string;

      // Validate input
      if (!input) {
        throw new RuntimeError("RILL-R004", "ext-name: input is required");
      }

      // Implementation here
      return input;
    },
    annotations: {
      description: "What this function does",
    },
    // Return type descriptor (used by rill type system)
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
  // Declare config fields and their types for validation
  // api_key: { type: "string" },
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
// Errors:
//   throw new RuntimeError("RILL-R004", "message")
//   Runtime wraps this as a rill extension error.
// ---------------------------------------------------------------------------

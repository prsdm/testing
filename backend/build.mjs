import { cp, readFile, rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const apiRoot = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(apiRoot, "dist");
const nodeBuiltins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`])
);

await rm(distDir, { force: true, recursive: true });

const sharedOptions = {
  bundle: true,
  format: "esm",
  legalComments: "none",
  platform: "node",
  plugins: [
    {
      name: "externalize-npm-dependencies",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^[^./]|^\.[^./]/ }, (args) => ({
          external:
            nodeBuiltins.has(args.path) ||
            (!args.path.startsWith(".") && !args.path.startsWith("@/")),
        }));
      },
    },
  ],
  sourcemap: false,
  target: "node20",
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: [resolve(apiRoot, "src/server.ts")],
    outfile: resolve(distDir, "server.js"),
  }),
  build({
    ...sharedOptions,
    entryPoints: [resolve(apiRoot, "src/migration/migrate.ts")],
    outfile: resolve(distDir, "migrate.js"),
  }),
]);

await cp(
  resolve(apiRoot, "src/core/lib/sandbox/skills/builtin"),
  resolve(distDir, "skills/builtin"),
  { recursive: true }
);

const bundle = await readFile(resolve(distDir, "server.js"), "utf8");
const forbiddenRuntimeReferences = [
  "better-auth/next-js",
  `@kimiro${"/"}`,
  "@/core/",
  "@/shared/",
  "@/contracts/",
  "next/",
];
const leakedReference = forbiddenRuntimeReferences.find((reference) =>
  bundle.includes(reference)
);
if (leakedReference) {
  throw new Error(
    `API bundle contains forbidden runtime reference: ${leakedReference}`
  );
}

const migrationBundle = await readFile(resolve(distDir, "migrate.js"), "utf8");
for (const forbiddenReference of [
  `@kimiro${"/"}`,
  "packages/",
  "apps/",
  "process.cwd",
]) {
  if (migrationBundle.includes(forbiddenReference)) {
    throw new Error(
      `Migration bundle contains forbidden reference: ${forbiddenReference}`
    );
  }
}

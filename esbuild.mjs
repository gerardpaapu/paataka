import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts", "src/scripts/create-invite.ts"],
  platform: "node",
  packages: "external",
  logLevel: "info",
  color: true,
  format: "esm",
  bundle: true, // we're using `.ts` extensions so we have to
  outdir: "dist",
});

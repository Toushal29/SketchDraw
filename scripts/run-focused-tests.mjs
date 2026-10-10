import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = await mkdtemp(path.join(repoRoot, ".focused-test-build-"));
const sourceFiles = [
  "src/features/files/parse-sketch.ts",
  "src/features/files/document-codec.ts",
  "src/features/files/sketch-recovery-store.ts",
  "src/platform/windows/sync.ts",
  "src/features/document/document-recovery.ts",
  "src/features/canvas/history.ts",
].map(file => path.join(repoRoot, file));

try {
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    rootDir: repoRoot,
    outDir: buildDir,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    ignoreDeprecations: "6.0",
    types: [],
  };
  const program = ts.createProgram(sourceFiles, options);
  const emit = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...emit.diagnostics];
  const errors = diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => repoRoot,
      getCanonicalFileName: file => file,
      getNewLine: () => "\n",
    }));
    process.exitCode = 1;
  } else {
    await writeFile(path.join(buildDir, "package.json"), JSON.stringify({ type: "commonjs" }));
    process.env.SKETCHDRAW_TEST_BUILD_DIR = buildDir;
    for (const file of ["tests/persistence.test.mjs", "tests/sync.test.mjs", "tests/canvas-history.test.mjs"]) {
      await import(pathToFileURL(path.join(repoRoot, file)).href);
    }
  }
} finally {
  await rm(buildDir, { recursive: true, force: true });
}

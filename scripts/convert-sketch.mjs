import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [inputArg, outputArg, ...extraArgs] = process.argv.slice(2);
if (!inputArg || !outputArg || extraArgs.length || inputArg.startsWith("-") || outputArg.startsWith("-")) {
  process.stderr.write("Usage: npm run convert:sketch -- <input.sketch> <output.sketch>\n");
  process.exitCode = 2;
} else {
  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(outputArg);
  const samePath = process.platform === "win32"
    ? inputPath.toLowerCase() === outputPath.toLowerCase()
    : inputPath === outputPath;
  if (!inputPath.toLowerCase().endsWith(".sketch") || !outputPath.toLowerCase().endsWith(".sketch")) {
    process.stderr.write("Both paths must use the .sketch extension.\n");
    process.exitCode = 2;
  } else if (samePath) {
    process.stderr.write("Choose a different output path; the source file is never overwritten.\n");
    process.exitCode = 2;
  } else {
    const buildDir = await mkdtemp(path.join(os.tmpdir(), "sketchdraw-v9-converter-"));
    try {
      const sourceFiles = [
        "src/features/files/parse-sketch.ts",
        "src/features/files/document-codec.ts",
      ].map(file => path.join(repoRoot, file));
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
        const require = createRequire(import.meta.url);
        const { parseSketchFile } = require(path.join(buildDir, "src/features/files/parse-sketch.js"));
        const { serializeSketchSnapshot } = require(path.join(buildDir, "src/features/files/document-codec.js"));
        const source = await readFile(inputPath, "utf8");
        const raw = JSON.parse(source);
        const sourceVersion = raw && typeof raw === "object" && Number.isInteger(Number(raw.version)) ? Number(raw.version) : "unknown";
        const snapshot = parseSketchFile(raw);
        if (!snapshot) throw new Error("The source is not a supported SketchDraw document or contains invalid data.");
        const contents = serializeSketchSnapshot(snapshot);
        await writeFile(outputPath, contents, { encoding: "utf8", flag: "wx" });
        process.stdout.write(`Converted SketchDraw v${sourceVersion} to v9.\n`);
        process.stdout.write(`Output: ${outputPath}\n`);
        process.stdout.write("Notebook notes and archived Library records were preserved.\n");
      }
    } catch (error) {
      process.stderr.write(`Conversion failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    } finally {
      await rm(buildDir, { recursive: true, force: true });
    }
  }
}

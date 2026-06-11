import { scanPublicTree } from "./public-tree-scan.mjs";

const result = scanPublicTree(process.cwd());

if (!result.ok) {
  console.error("Public tree security scan failed:");
  for (const failure of result.failures) {
    console.error(`- ${failure.path}: ${failure.reason}`);
  }
  process.exit(1);
}

console.log(`Public tree security scan passed (${result.scannedFileCount} files scanned).`);

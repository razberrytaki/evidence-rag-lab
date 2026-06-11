import { scanPublicClaims } from "./public-claim-scan.mjs";

const result = scanPublicClaims();

if (!result.ok) {
  console.error("Public claim safety scan failed:");
  for (const failure of result.failures) {
    console.error(`- ${failure.path}:${failure.line}: ${failure.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Public claim safety scan passed (${result.scannedFileCount} files scanned).`);
}

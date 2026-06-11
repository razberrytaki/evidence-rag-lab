import { scanPublicReadiness } from "./public-readiness-scan.mjs";

const result = scanPublicReadiness();

if (!result.ok) {
  console.error("Public readiness scan failed:");
  for (const failure of result.failures) {
    console.error(`- ${failure.path}: ${failure.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log("Public readiness scan passed.");
}

import { app } from "@/app.js";
import { env } from "@/config/env.js";

process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    "[Process] Unhandled Rejection:",
    reason instanceof Error ? (reason.stack ?? reason.message) : reason,
  );
});

process.on("uncaughtException", (err: unknown) => {
  console.error(
    "[Process] Uncaught Exception:",
    err instanceof Error ? (err.stack ?? err.message) : err,
  );
  process.exit(1);
});

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

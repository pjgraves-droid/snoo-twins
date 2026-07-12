import { loadConfig } from "./config.js";
import { createNotifier } from "./notifier.js";
import { buildMonitor } from "./monitor.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const notifier = createNotifier(cfg.twilio);
  const monitor = buildMonitor(cfg, notifier);

  console.log("snoo-alerts starting with config:");
  console.log(`  trigger level : ${cfg.triggerLevel}`);
  console.log(`  sustain       : ${cfg.sustainSeconds}s`);
  console.log(`  cooldown      : ${cfg.cooldownSeconds}s`);
  console.log(
    `  alert window  : ${String(cfg.alertStartHour).padStart(2, "0")}:00–` +
      `${String(cfg.alertEndHour).padStart(2, "0")}:00 ${cfg.alertTimezone}`
  );
  console.log(`  poll interval : ${cfg.pollIntervalMs}ms`);
  console.log(
    `  device filter : ${cfg.deviceFilter.length ? cfg.deviceFilter.join(", ") : "(all)"}`
  );
  console.log(
    `  notifier      : ${cfg.twilio ? `Twilio ${cfg.twilio.mode} → ${cfg.twilio.to}` : "console (dry run)"}`
  );

  let stopped = false;
  const shutdown = (signal: string) => {
    if (stopped) return;
    stopped = true;
    console.log(`\nReceived ${signal}, shutting down.`);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Recursive setTimeout (not setInterval) so a slow poll never overlaps.
  const loop = async (): Promise<void> => {
    if (stopped) return;
    try {
      await monitor.tick();
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] poll error:`,
        err instanceof Error ? err.message : err
      );
    }
    if (!stopped) {
      setTimeout(loop, cfg.pollIntervalMs);
    }
  };

  await loop();
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});

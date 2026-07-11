import type { Config } from "./config.js";
import type { Notifier } from "./notifier.js";
import {
  SnooClient,
  currentLevel,
  isOnline,
  type SnooDevice,
} from "./snoo.js";

interface DeviceState {
  /** Wall-clock ms when the device was first observed continuously at the trigger level. */
  enteredTriggerAt: number | null;
  /** Wall-clock ms of the most recent alert, for cooldown enforcement. */
  lastAlertAt: number | null;
  /** Last level we logged, to avoid noisy repeated logs. */
  lastLoggedLevel: string | null;
}

export class SnooMonitor {
  private readonly states = new Map<string, DeviceState>();

  constructor(
    private readonly client: SnooClient,
    private readonly notifier: Notifier,
    private readonly cfg: Config
  ) {}

  private watched(device: SnooDevice): boolean {
    if (this.cfg.deviceFilter.length === 0) return true;
    const hay = `${device.serialNumber} ${device.name}`.toLowerCase();
    return this.cfg.deviceFilter.some((f) => hay.includes(f.toLowerCase()));
  }

  private stateFor(serial: string): DeviceState {
    let s = this.states.get(serial);
    if (!s) {
      s = { enteredTriggerAt: null, lastAlertAt: null, lastLoggedLevel: null };
      this.states.set(serial, s);
    }
    return s;
  }

  /** Run one polling cycle. Returns the number of alerts fired this cycle. */
  async tick(now: number = Date.now()): Promise<number> {
    const devices = await this.client.getDevices();
    let fired = 0;

    for (const device of devices) {
      if (!this.watched(device)) continue;
      const state = this.stateFor(device.serialNumber);
      const level = currentLevel(device);
      const online = isOnline(device);

      if (level !== state.lastLoggedLevel) {
        console.log(
          `[${new Date(now).toISOString()}] ${device.name}: ${level ?? "unknown"}` +
            `${online ? "" : " (offline)"}`
        );
        state.lastLoggedLevel = level;
      }

      const atTrigger = online && level === this.cfg.triggerLevel;

      if (!atTrigger) {
        // Left the trigger level (or went offline): require a fresh sustained
        // period next time. Cooldown (lastAlertAt) is intentionally preserved.
        state.enteredTriggerAt = null;
        continue;
      }

      if (state.enteredTriggerAt === null) {
        state.enteredTriggerAt = now;
        console.log(
          `  → ${device.name} entered ${this.cfg.triggerLevel}; arming ` +
            `(${this.cfg.sustainSeconds}s sustain required)`
        );
        continue;
      }

      const heldSeconds = (now - state.enteredTriggerAt) / 1000;
      if (heldSeconds < this.cfg.sustainSeconds) continue;

      const cooldownOk =
        state.lastAlertAt === null ||
        (now - state.lastAlertAt) / 1000 >= this.cfg.cooldownSeconds;
      if (!cooldownOk) continue;

      state.lastAlertAt = now;
      fired++;
      const held = Math.round(heldSeconds);
      await this.notifier.send(
        `${device.name} at ${this.cfg.triggerLevel}`,
        `${device.name} has been at ${this.cfg.triggerLevel} for ${held}s ` +
          `(threshold ${this.cfg.sustainSeconds}s). Baby may need attention.`
      );
    }

    return fired;
  }
}

export function buildMonitor(cfg: Config, notifier: Notifier): SnooMonitor {
  const client = new SnooClient(cfg.email, cfg.password);
  return new SnooMonitor(client, notifier, cfg);
}

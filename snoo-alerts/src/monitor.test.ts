import assert from "node:assert/strict";
import test from "node:test";
import { SnooMonitor, isWithinAlertWindow } from "./monitor.js";
import type { Config } from "./config.js";
import type { Notifier } from "./notifier.js";
import type { SnooClient, SnooDevice } from "./snoo.js";

function device(level: string, online = true): SnooDevice {
  return {
    serialNumber: "SN1",
    name: "Test Snoo",
    baby: "b1",
    presenceIoT: { online },
    activityState: { state_machine: { state: level } },
  };
}

function makeConfig(over: Partial<Config> = {}): Config {
  return {
    email: "e",
    password: "p",
    pollIntervalMs: 10_000,
    triggerLevel: "LEVEL2",
    sustainSeconds: 30,
    cooldownSeconds: 300,
    deviceFilter: [],
    // Default the window to always-on so behaviour tests are time-independent;
    // the window itself is exercised by the dedicated tests below.
    alertTimezone: "UTC",
    alertStartHour: 0,
    alertEndHour: 0,
    twilio: null,
    ...over,
  };
}

class RecordingNotifier implements Notifier {
  public sent: string[] = [];
  async send(subject: string): Promise<void> {
    this.sent.push(subject);
  }
}

/** A client whose getDevices() returns whatever the test sets next. */
class FakeClient {
  public next: SnooDevice[] = [];
  async getDevices(): Promise<SnooDevice[]> {
    return this.next;
  }
}

function build(cfg: Config) {
  const client = new FakeClient();
  const notifier = new RecordingNotifier();
  const monitor = new SnooMonitor(
    client as unknown as SnooClient,
    notifier,
    cfg
  );
  return { client, notifier, monitor };
}

const SEC = 1000;

test("fires once LEVEL2 sustained past the threshold", async () => {
  const { client, notifier, monitor } = build(makeConfig());
  const t0 = 1_000_000;

  client.next = [device("LEVEL2")];
  await monitor.tick(t0); // arm
  assert.equal(notifier.sent.length, 0);

  await monitor.tick(t0 + 20 * SEC); // still under 30s
  assert.equal(notifier.sent.length, 0);

  await monitor.tick(t0 + 31 * SEC); // crosses 30s
  assert.equal(notifier.sent.length, 1);
});

test("does not fire for a brief LEVEL2 blip", async () => {
  const { client, notifier, monitor } = build(makeConfig());
  const t0 = 2_000_000;

  client.next = [device("LEVEL2")];
  await monitor.tick(t0); // arm

  client.next = [device("BASELINE")];
  await monitor.tick(t0 + 10 * SEC); // dropped before 30s -> reset

  client.next = [device("LEVEL2")];
  await monitor.tick(t0 + 15 * SEC); // re-arm from scratch
  await monitor.tick(t0 + 20 * SEC); // only 5s held
  assert.equal(notifier.sent.length, 0);
});

test("respects cooldown across episodes", async () => {
  const { client, notifier, monitor } = build(makeConfig());
  const t0 = 3_000_000;

  client.next = [device("LEVEL2")];
  await monitor.tick(t0);
  await monitor.tick(t0 + 31 * SEC); // fires #1
  assert.equal(notifier.sent.length, 1);

  // leave and come back quickly (within cooldown)
  client.next = [device("BASELINE")];
  await monitor.tick(t0 + 40 * SEC);
  client.next = [device("LEVEL2")];
  await monitor.tick(t0 + 45 * SEC);
  await monitor.tick(t0 + 80 * SEC); // sustained again but inside 300s cooldown
  assert.equal(notifier.sent.length, 1);

  // after cooldown elapses, a sustained episode fires again
  client.next = [device("BASELINE")];
  await monitor.tick(t0 + 400 * SEC);
  client.next = [device("LEVEL2")];
  await monitor.tick(t0 + 405 * SEC);
  await monitor.tick(t0 + 440 * SEC);
  assert.equal(notifier.sent.length, 2);
});

test("ignores the level when the device is offline", async () => {
  const { client, notifier, monitor } = build(makeConfig());
  const t0 = 4_000_000;
  client.next = [device("LEVEL2", false)];
  await monitor.tick(t0);
  await monitor.tick(t0 + 60 * SEC);
  assert.equal(notifier.sent.length, 0);
});

test("device filter limits which devices are watched", async () => {
  const { client, notifier, monitor } = build(
    makeConfig({ deviceFilter: ["Miles"] })
  );
  const t0 = 5_000_000;
  client.next = [device("LEVEL2")]; // name "Test Snoo" -> not matched
  await monitor.tick(t0);
  await monitor.tick(t0 + 31 * SEC);
  assert.equal(notifier.sent.length, 0);
});

test("isWithinAlertWindow handles overnight, daytime and 24h windows", () => {
  // Overnight window 22:00–07:00
  assert.equal(isWithinAlertWindow(23, 22, 7), true);
  assert.equal(isWithinAlertWindow(0, 22, 7), true);
  assert.equal(isWithinAlertWindow(6, 22, 7), true);
  assert.equal(isWithinAlertWindow(7, 22, 7), false); // end is exclusive
  assert.equal(isWithinAlertWindow(21, 22, 7), false);
  assert.equal(isWithinAlertWindow(12, 22, 7), false);
  // Same-day window 9:00–17:00
  assert.equal(isWithinAlertWindow(9, 9, 17), true);
  assert.equal(isWithinAlertWindow(17, 9, 17), false);
  assert.equal(isWithinAlertWindow(8, 9, 17), false);
  // start === end means always on
  assert.equal(isWithinAlertWindow(3, 0, 0), true);
});

test("does not fire outside the alert window", async () => {
  // 09:00 UTC is outside a 22:00–07:00 UTC window.
  const { client, notifier, monitor } = build(
    makeConfig({ alertTimezone: "UTC", alertStartHour: 22, alertEndHour: 7 })
  );
  const t0 = Date.UTC(2026, 0, 1, 9, 0, 0);
  client.next = [device("LEVEL2")];
  await monitor.tick(t0);
  await monitor.tick(t0 + 31 * SEC);
  assert.equal(notifier.sent.length, 0);
});

test("fires inside the alert window", async () => {
  // 02:00 UTC is inside a 22:00–07:00 UTC window.
  const { client, notifier, monitor } = build(
    makeConfig({ alertTimezone: "UTC", alertStartHour: 22, alertEndHour: 7 })
  );
  const t0 = Date.UTC(2026, 0, 1, 2, 0, 0);
  client.next = [device("LEVEL2")];
  await monitor.tick(t0); // arm
  await monitor.tick(t0 + 31 * SEC); // crosses 30s
  assert.equal(notifier.sent.length, 1);
});

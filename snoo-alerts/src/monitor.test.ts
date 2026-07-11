import assert from "node:assert/strict";
import test from "node:test";
import { SnooMonitor } from "./monitor.js";
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

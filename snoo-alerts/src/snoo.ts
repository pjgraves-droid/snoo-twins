const API_BASE = "https://api-us-east-1-prod.happiestbaby.com";
const COGNITO_ENDPOINT = "https://cognito-idp.us-east-1.amazonaws.com/";
const CLIENT_ID = "6kqofhc8hm394ielqdkvli0oea";

interface CognitoAuthResult {
  AuthenticationResult?: {
    IdToken: string;
    AccessToken: string;
    RefreshToken: string;
    ExpiresIn: number;
  };
}

export interface StateMachine {
  state: string;
  audio?: string;
  hold?: string;
  weaning?: string;
  prev_state?: string;
  up_transition?: string;
  down_transition?: string;
  is_active_session?: string;
  session_id?: string;
}

export interface ActivityState {
  event?: string;
  event_time_ms?: number;
  state_machine?: StateMachine;
  system_state?: string;
}

export interface SnooDevice {
  serialNumber: string;
  name: string;
  baby: string;
  presenceIoT?: { online?: boolean };
  presence?: { online?: boolean };
  activityState?: ActivityState;
}

/**
 * Minimal Snoo cloud client: Cognito auth with token caching/refresh and a
 * devices fetch that carries each device's live activityState.
 */
export class SnooClient {
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private readonly email: string,
    private readonly password: string
  ) {}

  private async authenticate(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const res = await fetch(COGNITO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify({
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: this.email, PASSWORD: this.password },
        ClientId: CLIENT_ID,
      }),
    });

    if (!res.ok) {
      throw new Error(`Auth failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as CognitoAuthResult;
    const result = data.AuthenticationResult;
    if (!result?.IdToken) {
      throw new Error("Authentication failed - no token in response");
    }

    this.token = result.IdToken;
    this.tokenExpiry = Date.now() + (result.ExpiresIn - 60) * 1000;
    return this.token;
  }

  async getDevices(): Promise<SnooDevice[]> {
    const token = await this.authenticate();
    const res = await fetch(`${API_BASE}/ds/me/v10/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      // Token may have been revoked/expired early; force a refresh next call.
      this.token = null;
      this.tokenExpiry = 0;
      throw new Error(`Devices request unauthorized (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(`Devices request failed (${res.status}): ${await res.text()}`);
    }

    return (await res.json()) as SnooDevice[];
  }
}

export function isOnline(device: SnooDevice): boolean {
  return Boolean(device.presenceIoT?.online ?? device.presence?.online);
}

export function currentLevel(device: SnooDevice): string | null {
  return device.activityState?.state_machine?.state ?? null;
}

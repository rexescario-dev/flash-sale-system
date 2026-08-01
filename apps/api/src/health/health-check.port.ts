export interface HealthCheckResult {
  status: string;
}

export interface HealthCheck {
  check(): Promise<HealthCheckResult>;
  readonly name: string;
}

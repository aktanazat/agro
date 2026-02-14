import type { TraceEvent, TraceStage } from "./types";

export class PipelineTracer {
  private traceId: string;
  private events: TraceEvent[] = [];
  private pending: Map<TraceStage, string> = new Map();

  constructor(traceId: string) {
    this.traceId = traceId;
  }

  begin(stage: TraceStage): void {
    this.pending.set(stage, new Date().toISOString());
  }

  end(stage: TraceStage, status: TraceEvent["status"], metadata?: Record<string, unknown>): void {
    const startedAt = this.pending.get(stage);
    if (!startedAt) {
      throw new Error(`No pending trace for stage: ${stage}`);
    }
    this.pending.delete(stage);

    const endedAt = new Date().toISOString();
    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();

    const event: TraceEvent = {
      traceId: this.traceId,
      stage,
      startedAt,
      endedAt,
      durationMs,
      status,
      ...metadata ? { metadata } : {},
    };

    this.events.push(event);
  }

  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  getTotalDurationMs(): number {
    return this.events.reduce((sum, e) => sum + e.durationMs, 0);
  }
}

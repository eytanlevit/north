const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_INTERVAL = 80;

export class ActivityIndicator {
  private frameIndex = 0;
  private tools: string[] = [];
  private startTime = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.frameIndex = 0;
    this.tools = [];
    this.startTime = Date.now();
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
    }, FRAME_INTERVAL);
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  addTool(name: string): void {
    if (!this.tools.includes(name)) {
      this.tools.push(name);
    }
  }

  render(): string {
    const spinner = SPINNER_FRAMES[this.frameIndex];
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const label = this.tools.length > 0 ? this.tools.join(", ") : "Thinking";
    return `${spinner} ${label} (${elapsed}s)`;
  }
}

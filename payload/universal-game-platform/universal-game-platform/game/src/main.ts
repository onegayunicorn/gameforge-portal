/**
 * Game entry point — web target.
 * Implements GameModule interface from @ugp/runtime-contracts.
 */
import type { GameModule, GameContext } from '@ugp/runtime-contracts';

export class MyGame implements GameModule {
  id = 'replace-with-game-id';
  version = '0.1.0';

  async initialize(context: GameContext): Promise<void> {
    console.log('[Game] Initializing...', context.runtime.getPlatform());
  }

  update(deltaSeconds: number): void {
    // Fixed-step game logic
  }

  render(alpha: number): void {
    // Interpolated render
  }

  pause(): void { console.log('[Game] Paused'); }
  resume(): void { console.log('[Game] Resumed'); }
  async shutdown(): Promise<void> { console.log('[Game] Shutting down'); }
}

// Bootstrap
if (typeof window !== 'undefined') {
  // Platform runtime will load and initialize the game module
  (window as any).__GAME_MODULE__ = MyGame;
}

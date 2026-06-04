import Phaser from 'phaser';

export class EventBus extends Phaser.Events.EventEmitter {
  private static instance: EventBus;

  static getInstance(): EventBus {
    if (!EventBus.instance) EventBus.instance = new EventBus();
    return EventBus.instance;
  }

  /** Call at start of each run to clear listeners from previous run. */
  static reset(): void {
    EventBus.instance?.removeAllListeners();
  }
}

type DevServerLockModule = {
  DEV_SERVER_LOCK_FILENAME: string;
  getDevServerLockPath(cwd: string): string;
  findActiveDevServerLock(input: {
    cwd: string;
    isProcessRunning?: (pid: number) => Promise<boolean>;
    readProcessCommand?: (pid: number) => Promise<string | null>;
  }): Promise<
    | {
        active: true;
        lockPath: string;
        message: string;
        pid: number;
        startedAt: string | null;
      }
    | {
        active: false;
        lockPath: string;
      }
  >;
  acquireDevServerLock(input: {
    cwd: string;
    pid?: number;
    command?: string;
    isProcessRunning?: (pid: number) => Promise<boolean>;
    readProcessCommand?: (pid: number) => Promise<string | null>;
  }): Promise<
    | {
        acquired: true;
        lockPath: string;
        release: () => Promise<void>;
      }
    | {
        acquired: false;
        lockPath: string;
        message: string;
      }
  >;
  formatDevServerLockMessage(input: {
    lockPath: string;
    pid: number | null;
    startedAt: string | null;
  }): string;
};

export async function loadDevServerLockModule() {
  // @ts-ignore The script is authored as .mjs and exercised directly by the test harness.
  return (await import("../../scripts/dev/dev-server-lock.mjs")) as DevServerLockModule;
}

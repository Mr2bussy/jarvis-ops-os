// @ts-nocheck
declare module 'imapflow' {
  export class ImapFlow {
    constructor(opts: Record<string, unknown>);
    connect(): Promise<void>;
    logout(): Promise<void>;
    mailboxOpen(path: string): Promise<unknown>;
    idle(): Promise<unknown>;
    on(event: string, cb: (...args: unknown[]) => void): void;
  }
}

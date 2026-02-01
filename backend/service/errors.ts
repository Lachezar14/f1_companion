export class OpenF1ServiceError extends Error {
    public readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'OpenF1ServiceError';
        this.cause = cause;
    }
}

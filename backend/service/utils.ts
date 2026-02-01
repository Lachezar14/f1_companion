import { OpenF1ServiceError } from './errors';

export async function withServiceError<T>(message: string, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        console.error(message, error);
        if (error instanceof OpenF1ServiceError) {
            throw error;
        }
        throw new OpenF1ServiceError(message, error);
    }
}

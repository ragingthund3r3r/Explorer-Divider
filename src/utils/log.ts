export type Logger = (...args: unknown[]) => void;

export function initLog(prefix: string, color = "#00bcd4"): Logger {
	return (...args: unknown[]) => {
		// eslint-disable-next-line no-console
		console.log(`%c${prefix}`, `color: ${color}; font-weight: 600;`, ...args);
	};
}

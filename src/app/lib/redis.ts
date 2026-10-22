import Redis from "ioredis";

class MemoryCache {
	private store = new Map<string, { value: string; expiresAt?: number }>();

	get(key: string): string | null {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (entry.expiresAt && entry.expiresAt < Date.now()) {
			this.store.delete(key);
			return null;
		}
		return entry.value;
	}

	set(key: string, value: string, ttlSeconds?: number): void {
		const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
		this.store.set(key, { value, expiresAt });
	}

	del(key: string): void {
		this.store.delete(key);
	}

	delByPattern(pattern: string): void {
		const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
		for (const key of this.store.keys()) {
			if (regex.test(key)) {
				this.store.delete(key);
			}
		}
	}
}

const memoryCache = new MemoryCache();

let redisInstance: Redis | null = null;
let isRedisConnected = false;
let warningLogged = false;

try {
	const redisUrl = process.env.REDIS_URL;
	redisInstance = redisUrl
		? new Redis(redisUrl, {
				lazyConnect: true,
				maxRetriesPerRequest: 1,
				connectTimeout: 2000,
				enableOfflineQueue: false,
			})
		: new Redis({
				lazyConnect: true,
				maxRetriesPerRequest: 1,
				connectTimeout: 2000,
				enableOfflineQueue: false,
			});

	redisInstance.on("connect", () => {
		isRedisConnected = true;
		console.log("Redis cache connected successfully.");
	});

	redisInstance.on("error", (err) => {
		isRedisConnected = false;
		if (!warningLogged) {
			console.warn(
				"Notice: Redis unavailable, operating with in-memory cache fallback.",
				err.message,
			);
			warningLogged = true;
		}
	});

	// Attempt lazy non-blocking connection
	redisInstance.connect().catch((err) => {
		isRedisConnected = false;
		if (!warningLogged) {
			console.warn(
				"Notice: Redis connection failed, continuing with in-memory cache fallback.",
				err.message,
			);
			warningLogged = true;
		}
	});
} catch {
	isRedisConnected = false;
}

export const cache = {
	async get(key: string): Promise<string | null> {
		if (redisInstance && isRedisConnected) {
			try {
				const data = await redisInstance.get(key);
				if (data !== null) return data;
			} catch {
				// fallback to memory
			}
		}
		return memoryCache.get(key);
	},

	async set(key: string, value: string, ttlSeconds = 60): Promise<void> {
		memoryCache.set(key, value, ttlSeconds);
		if (redisInstance && isRedisConnected) {
			try {
				await redisInstance.set(key, value, "EX", ttlSeconds);
			} catch {
				// ignore redis write error and rely on memory
			}
		}
	},

	async del(key: string | string[]): Promise<void> {
		const keys = Array.isArray(key) ? key : [key];
		for (const k of keys) {
			memoryCache.del(k);
		}
		if (redisInstance && isRedisConnected) {
			try {
				await redisInstance.del(...keys);
			} catch {
				// ignore
			}
		}
	},

	async delByPattern(pattern: string): Promise<void> {
		memoryCache.delByPattern(pattern);
		if (redisInstance && isRedisConnected) {
			try {
				const stream = redisInstance.scanStream({
					match: pattern,
					count: 100,
				});
				stream.on("data", (keys: string[]) => {
					if (keys.length) {
						redisInstance?.del(...keys);
					}
				});
			} catch {
				// ignore
			}
		}
	},

	isConnected(): boolean {
		return isRedisConnected;
	},
};

import redis from "./redis.js"

const getOrSetCache = async (key, ttlSeconds, fetchFn) => {
    const cached = await redis.get(key)
    if (cached) {
        return JSON.parse(cached)
    }

    const freshData = await fetchFn()
    await redis.set(key, JSON.stringify(freshData), 'EX', ttlSeconds)
    return freshData
}

// production-safe version of "find all keys matching a pattern"
const scanKeys = async (pattern) => {
    let cursor = '0'
    let allKeys = []

    do {
        // SCAN returns [nextCursor, batchOfKeys]
        const [nextCursor, keys] = await redis.scan(
            cursor,
            'MATCH', pattern,
            'COUNT', 100 // how many keys to inspect per internal step (not a hard limit on results)
        )
        cursor = nextCursor
        allKeys.push(...keys)
    } while (cursor !== '0') // Redis returns '0' when the full scan cycle is complete

    return allKeys
}

const invalidateCache = async (pattern) => {
    //const keys = await redis.keys(pattern)//redis.keys(pattern) walks the entire keyspace in one go, and Redis is single-threaded — while it's doing that scan, it can't serve any other commands.
    const keys = await scanKeys(pattern)
    if (keys.length) {
        await redis.del(keys)
    }
}

export { getOrSetCache, invalidateCache }
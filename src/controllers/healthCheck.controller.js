import os from "os";
import mongoose from "mongoose";
import redis from "../utils/redis.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const loadAvg = os.loadavg();
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    let redisStatus = "unknown";

    try {
        await redis.ping();
        redisStatus = "connected";
    } catch (error) {
        redisStatus = "disconnected";
    }

    const isHealthy = mongoStatus === "connected" && redisStatus === "connected";

    const healthData = {
        status: isHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || "development",
        process: {
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version,
        },
        memory: {
            rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
            arrayBuffers: `${(memory.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
            freeSystemMemory: `${(os.freemem() / 1024 / 1024).toFixed(2)} MB`,
            totalSystemMemory: `${(os.totalmem() / 1024 / 1024).toFixed(2)} MB`,
        },
        cpu: {
            userMicroseconds: cpu.user,
            systemMicroseconds: cpu.system,
            loadAverage: {
                oneMinute: Number(loadAvg[0].toFixed(2)),
                fiveMinutes: Number(loadAvg[1].toFixed(2)),
                fifteenMinutes: Number(loadAvg[2].toFixed(2)),
            },
        },
        dependencies: {
            mongodb: mongoStatus,
            redis: redisStatus,
        },
    };

    return res
        .status(isHealthy ? 200 : 503)
        .json(
            new ApiResponse(
                isHealthy ? 200 : 503,
                healthData,
                isHealthy ? "Server is healthy" : "Server is running but dependencies are degraded"
            )
        );
});

export {
    healthcheck
};
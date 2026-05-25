import ffmpeg from "fluent-ffmpeg"
import ffmpegStatic from "ffmpeg-static"
import path from "path"//Node's built-in path module. Gives you OS-safe utilities for joining folder/file names (path.join), getting extensions, etc.
import fs from "fs"

// FFmpeg on Windows needs forward slashes not backslashes
const toFFmpegPath = (p) => p.replace(/\\/g, "/")

//convertToHLS
export const convertToHLS = (inputPath, videoId) => {
    return new Promise((resolve, reject) => {

        // create output folder
        const outputDir = path.join("public", "hls", videoId)
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }
        const outputPath = path.join(outputDir, "index.m3u8")

        //convert all paths to forward slashes for FFmpeg on Windows
        const inputFFmpeg = toFFmpegPath(inputPath)
        const outputFFmpeg = toFFmpegPath(outputPath)
        const chunkPattern = toFFmpegPath(
            path.join(outputDir, "chunk_%03d.ts")
        )

        ffmpeg(inputFFmpeg)
            .videoCodec("libx264")
            .audioCodec("aac")
            .outputOptions([
                "-hls_time 10",
                "-hls_list_size 0",
                "-hls_segment_filename",
                chunkPattern,         // forward slash path
                "-f hls"   //Forces the output format to HLS. Normally FFmpeg guesses the format from the output file extension, but being explicit avoids any ambiguity.
            ])
            .output(outputFFmpeg)     //Sets where the .m3u8 playlist file will be written.

            .on("start", (command) => {
                console.log("FFmpeg started")
            })
            .on("progress", (progress) => {
                // Windows terminal shows this in real time
                process.stdout.write(`\rProcessing: ${Math.round(progress.percent || 0)}%`)
            })
            .on("end", () => {
                console.log("\nHLS conversion complete!")
                resolve(outputDir)   // ← changed from outputPath to outputDir
                //resolve(outputDir) returns the FOLDER path "public/hls/uuid"
                //not the FILE path "public/hls/uuid/index.m3u8"
                //uploadHLSToCloudinary needs the folder to scan all files inside it
            })
            .on("error", (err) => {
                console.error("\nFFmpeg error:", err.message)
                reject(new Error(`FFmpeg conversion failed: ${err.message}`))
            })
            .run()
            //Executes the FFmpeg command. Nothing actually happens until .run() is called — all the previous chained methods just build up configuration.
    })
}

//getVideoDuration
// Get video duration in seconds using FFmpeg
// Called after conversion to save duration in MongoDB
export const getVideoDuration = (inputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(toFFmpegPath(inputPath), (err, metadata) => {
            /*ffprobe is a companion tool to FFmpeg that reads a media file's metadata without decoding it — much faster than full processing. 
            fluent-ffmpeg exposes it as ffmpeg.ffprobe(path, callback). The callback receives err (if something went wrong) and metadata (a rich object with streams, format info, etc.).*/
            if (err) {
                reject(err)
                return
            }
            resolve(Math.round(metadata.format.duration || 0))//metadata.format.duration is the video duration in seconds as a float
            //|| 0 handles the edge case where duration is undefined (e.g. for corrupted files). This value gets saved to MongoDB as the duration field on the Video document.
        })
    })
}

// cleanupLocalFiles 
export const cleanupLocalFiles = (folderPath) => {
    try {
        if (fs.existsSync(folderPath)) {
            // Windows sometimes locks files briefly after FFmpeg finishes
            // small delay before deletion
            setTimeout(() => {
                fs.rmSync(folderPath, { recursive: true, force: true })
                console.log("Local HLS files cleaned up")
            }, 1000)  // 1 second delay
        }
    } catch (err) {
        // non-critical — just log, don't crash
        console.error("Cleanup error (non-critical):", err.message)
    }
}
import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
import path from "path"


// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const normalizePath = (p) => p.replace(/\\/g, "/")


//Upload (Images / Small Files)
export const uploadOnCloudinary = async (localFilePath, folder = "general") => {
// localFilePath — The path to the file on your computer you want to upload.
// folder = "general" — The destination folder on Cloudinary. Defaults to "general" if you don't specify one.
    try {
        if (!localFilePath) return null

        const normalizedPath = normalizePath(localFilePath)

        const response = await cloudinary.uploader.upload(normalizedPath, {
            resource_type: "auto", // auto-detect image/video 
            folder: `YTweet/${folder}`,
            use_filename: true,
            unique_filename: true,
        })

        // async delete (non-blocking)
        fs.unlink(localFilePath, () => {})//do nothing if there's an error deleting

        return response//Returns the full Cloudinary response object, which contains useful info like secure_url (the public link to your uploaded file).

    } catch (error) {
        console.error("Cloudinary Upload Error:", error.message)
        try { fs.unlink(localFilePath, () => {}) } catch {}
        return null
    }
}

// Upload HLS (Video Streaming)
export const uploadHLSToCloudinary = async (hlsFolderPath, videoId) => {
    try {
        const files = fs.readdirSync(hlsFolderPath)
        console.log(`Uploading ${files.length} HLS files...`)

        // Upload all .ts chunks in parallel 
        await Promise.all(
            files
                .filter(file => file.endsWith(".ts"))
                .map(file => {
                    const filePath = normalizePath(
                        path.join(hlsFolderPath, file)//path.join(...) — Builds the full file path, e.g. /tmp/video123/chunk0.ts
                    )

                    return cloudinary.uploader.upload(filePath, {
                        resource_type: "raw", // required for .ts files
                        folder: `hls/${videoId}`,
                        public_id: file,
                        use_filename: true,
                        unique_filename: false,
                    })
                })
        )

        console.log("All chunks uploaded")

        //Rewrite .m3u8 with Cloudinary URLs 
        const m3u8Path = path.join(hlsFolderPath, "index.m3u8")
        let content = fs.readFileSync(m3u8Path, "utf8")//reads as string ,utf-8--> readable text

        const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/hls/${videoId}/`

        content = content
            .split("\n")
            .map(line =>
                line.trim().endsWith(".ts")
                    ? baseUrl + line.trim()
                    : line
            )
            .join("\n")
        fs.writeFileSync(m3u8Path,content)

        //Step 3: Upload updated .m3u8 
        const m3u8Response = await cloudinary.uploader.upload(
            normalizePath(m3u8Path),
            {
                resource_type: "raw",
                folder: `hls/${videoId}`,
                public_id: "index.m3u8",
                use_filename: true,
                unique_filename: false,
            }
        )

        console.log("HLS upload complete")

        return m3u8Response.secure_url//Returns the public HTTPS URL of the uploaded playlist. A video player can use this single URL to stream the entire video.

    } catch (error) {
        console.error("Cloudinary HLS Upload Error:", error)
        throw error
    }
}


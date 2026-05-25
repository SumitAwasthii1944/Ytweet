import connectDB from './src/db/index.js';
import { Playlist } from './src/models/playlist.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    await connectDB();
    
    console.log("Connected to DB, running aggregation...");
    const playlists = await Playlist.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $addFields: {
                totalVideos: { $size: "$videos" },
                owner: { $first: "$owner" }
            }
        },
        {
            $project: {
                name: 1,
                owner: 1
            }
        },
        { $limit: 2 }
    ]);
    
    console.log(JSON.stringify(playlists, null, 2));
    process.exit(0);
}

run().catch(console.error);

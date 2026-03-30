import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

// ─── Helper ───────────────────────────────────────────────────────────────────
// Reusable pipeline to fetch a single playlist WITH fully populated videos
// Used by addVideoToPlaylist and removeVideoFromPlaylist so they return
// the same shape as getPlaylistById — frontend always gets consistent data
const getPlaylistWithVideos = async (playlistId) => {
    const result = await Playlist.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(playlistId) }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },
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
                description: 1,
                videos: 1,
                totalVideos: 1,
                owner: {
                    username: 1,
                    fullName: 1,
                    avatar: 1
                },
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    return result[0]
}

// ─── CREATE PLAYLIST ──────────────────────────────────────────────────────────
const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body

    if (!name || !description) {
        throw new ApiError(400, "Name and description are required")
    }

    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user._id,
        videos: []
    })

    if (!playlist) {
        throw new ApiError(500, "Error creating playlist")
    }

    return res.status(201).json(
        new ApiResponse(201, playlist, "Playlist created successfully")
    )
})

// ─── GET USER PLAYLISTS ───────────────────────────────────────────────────────
const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId")
    }

    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },
        {
            $addFields: {
                totalVideos: { $size: "$videos" },
                thumbnail: { $first: "$videos.thumbnail" }
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                totalVideos: 1,
                thumbnail: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    return res.status(200).json(
        new ApiResponse(200, playlists, "User playlists fetched successfully")
    )
})

// ─── GET PLAYLIST BY ID ───────────────────────────────────────────────────────
const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    const playlist = await getPlaylistWithVideos(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    return res.status(200).json(
        new ApiResponse(200, playlist, "Playlist fetched successfully")
    )
})

// ─── ADD VIDEO TO PLAYLIST ────────────────────────────────────────────────────
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    const playlist = await Playlist.findOne({
        _id: playlistId,
        owner: req.user._id
    })
    if (!playlist) {
        throw new ApiError(404, "Playlist not found or unauthorized")
    }

    if (playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video already in playlist")
    }

    await Playlist.findByIdAndUpdate(
        playlistId,
        { $push: { videos: videoId } },
        { new: true }
    )

    // ✅ fetch with aggregation so videos are fully populated objects
    // not just ObjectId strings — frontend gets consistent shape
    const updatedPlaylist = await getPlaylistWithVideos(playlistId)

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully")
    )
})

// ─── REMOVE VIDEO FROM PLAYLIST ───────────────────────────────────────────────
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const playlist = await Playlist.findOne({
        _id: playlistId,
        owner: req.user._id
    })
    if (!playlist) {
        throw new ApiError(404, "Playlist not found or unauthorized")
    }

    await Playlist.findByIdAndUpdate(
        playlistId,
        { $pull: { videos: videoId } },
        { new: true }
    )

    // ✅ fetch with aggregation so videos are fully populated objects
    // not just ObjectId strings — frontend gets consistent shape
    const updatedPlaylist = await getPlaylistWithVideos(playlistId)

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video removed from playlist successfully")
    )
})

// ─── DELETE PLAYLIST ──────────────────────────────────────────────────────────
const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    const playlist = await Playlist.findOneAndDelete({
        _id: playlistId,
        owner: req.user._id
    })

    if (!playlist) {
        throw new ApiError(404, "Playlist not found or unauthorized")
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Playlist deleted successfully")
    )
})

// ─── UPDATE PLAYLIST ──────────────────────────────────────────────────────────
const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    if (!name && !description) {
        throw new ApiError(400, "Provide name or description to update")
    }

    const updatedPlaylist = await Playlist.findOneAndUpdate(
        {
            _id: playlistId,
            owner: req.user._id
        },
        {
            $set: { name, description }
        },
        { new: true }
    )

    if (!updatedPlaylist) {
        // ✅ fix: was ApiError(404, updatePlaylist, "...") — updatePlaylist is the
        // function not the data, and error throws nothing anyway
        throw new ApiError(404, "Playlist not found or unauthorized")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    )
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
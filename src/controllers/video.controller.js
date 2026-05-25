import mongoose, { isValidObjectId } from 'mongoose'
import { Video } from '../models/video.model.js'
import { User } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { convertToHLS,getVideoDuration  } from "../utils/hls.js"           
import { uploadHLSToCloudinary } from "../utils/cloudinary.js" 
import { v4 as uuidv4 } from "uuid"   
import fs from 'fs';               

// Reusable pipeline to fetch a single video WITH likesCount + isLiked + owner
// Used by publishAVideo and updateVideo so they return the same shape
// as getAllVideos and getVideoById — frontend always gets consistent data
const getVideoWithLikes = async (videoId, userId) => {
    const result = await Video.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(videoId) }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        
        {
            $addFields: {
                likesCount: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(userId), "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                },
                
            }
        },
        {
            $project: { likes: 0 }  // remove raw likes array
        }
    ])

    return result[0]
}


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    const match = {}

    if (query) {
        match.title = { $regex: query, $options: "i" }
    }

    //validate userId before converting to ObjectId
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        match.owner = new mongoose.Types.ObjectId(userId)
    }

    match.isPublished = true

    const sortOptions = {}

    if (sortBy) {
        sortOptions[sortBy] = sortType === "asc" ? 1 : -1
    } else {
        sortOptions.createdAt = -1
    }

    const pipeline = [
        {
            $match: match
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
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
                likesCount: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        //explicitly convert to ObjectId for correct $in comparison
                        if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                },
                owner:{$first:"$owner"}
            }
        },
        {
            $project: { likes: 0 }
        },
        {
            $sort: sortOptions
        }
    ]

    const options = {
        page: parseInt(page),
        limit: parseInt(limit)
    }

    const videos = await Video.aggregatePaginate(Video.aggregate(pipeline), options)

    return res.status(200).json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description,isPublished  } = req.body

    if (!title || !description) {
        throw new ApiError(400, "Title and description are required")
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required")
    }
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    //convert video to hls chunks locally
    const videoId=uuidv4()//for unique folder name per video
    const hlsFolderPath = await convertToHLS(videoLocalPath, videoId)
    //upload hls folder to cloudinary get streaming url
    const hlsUrl=await uploadHLSToCloudinary(hlsFolderPath,videoId)
    fs.rmSync(hlsFolderPath, { recursive: true, force: true })

    if (!hlsUrl) throw new ApiError(400, "Error uploading video")

    if (!thumbnail?.url) {
        throw new ApiError(400, "Error uploading thumbnail")
    }

    const duration = await getVideoDuration(videoLocalPath)

    const newVideo = await Video.create({
        videoFile: hlsUrl,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: duration || 0,
        owner: req.user._id,
        isPublished: isPublished === "true" || isPublished === true  //handle both string and boolean (FormData sends strings)
    })

    // fetch with likesCount + isLiked so frontend gets consistent shape
    // likesCount = 0, isLiked = false for a brand new video
    const videoWithLikes = await getVideoWithLikes(newVideo._id, req.user._id)

    return res.status(200).json(
        new ApiResponse(200, videoWithLikes, "Video published successfully")
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video Id")
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
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
                likesCount: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                },
                owner: { $first: "$owner" }
            }
        },
        {
            $project: {
                likes: 0,
                "owner.password": 0,
                "owner.email": 0,
                "owner.watchHistory": 0
            }
        }
    ])

    if (!video?.length) {
        throw new ApiError(404, "Video not found")
    }

    // add to watch history
    await User.findByIdAndUpdate(
        req.user._id,
        { $addToSet: { watchHistory: videoId } }//addtoSet prevents duplicates in watch history
    )

    return res.status(200).json(
        new ApiResponse(200, video[0], "Video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    const thumbnailLocalPath = req.file?.path

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video Id")
    }

    let updateFields = {
        title,
        description
    }

    if (thumbnailLocalPath) {
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
        updateFields.thumbnail = thumbnail.url
    }

    const updatedVideo = await Video.findOneAndUpdate(
        {
            _id: videoId,
            owner: req.user._id
        },
        {
            $set: updateFields
        },
        { new: true }
    )

    if (!updatedVideo) {
        throw new ApiError(404, "Video not found or unauthorized")
    }

    //fetch with likesCount + isLiked so frontend gets consistent shape
    // preserves existing likesCount + isLiked after edit
    const videoWithLikes = await getVideoWithLikes(videoId, req.user._id)

    return res.status(200).json(
        new ApiResponse(200, videoWithLikes, "Video updated successfully")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!videoId) {
        throw new ApiError(400, "videoId not found")
    }
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video Id")
    }

    const deletedVideo = await Video.findOneAndDelete({
        _id: videoId,
        owner: req.user._id
    })

    if (!deletedVideo) {
        throw new ApiError(404, "Video not found or unauthorized")
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Video deleted successfully")
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!videoId) {
        throw new ApiError(400, "videoId not found")
    }
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video Id")
    }

    const video = await Video.findOne({
        _id: videoId,
        owner: req.user._id
    })

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res.status(200).json(
        new ApiResponse(200, video, "Publish status toggled successfully")
    )
})

const incrementViews = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video Id")
    }

    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } })

    return res.status(200).json(
        new ApiResponse(200, {}, "Views incremented successfully")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    incrementViews
}
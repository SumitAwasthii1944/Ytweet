import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

// Reusable pipeline to fetch a single tweet WITH totalLikes + isLiked
// Used by createTweet and updateTweet so they return the same shape
// as getUserTweets — frontend slice always gets consistent data
const getTweetWithLikes = async (tweetId, userId) => {
    const result = await Tweet.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(tweetId) }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes"
            }
        },
        {
            $addFields: {
                totalLikes: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(userId), "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            // remove the raw likes array, frontend doesn't need it
            $project: { likes: 0 }
        }
    ])

    return result[0] // aggregate returns array, we want the single tweet
}

// ─── Controllers ──────────────────────────────────────────────────────────────

const createTweet = asyncHandler(async (req, res) => {
    const { title, content } = req.body

    if (!title || !content) {
        throw new ApiError(400, "Title and content are required")
    }

    const mediaPath = req.file?.path
    const tweetMedia = mediaPath ? await uploadOnCloudinary(mediaPath) : null

    const newTweet = await Tweet.create({
        title,
        content,
        media: tweetMedia?.url || null,
        owner: req.user._id
    })

    // Fetch the created tweet WITH like data so frontend gets consistent shape
    // totalLikes = 0, isLiked = false for a brand new tweet
    const tweetWithLikes = await getTweetWithLikes(newTweet._id, req.user._id)

    return res.status(200).json(
        new ApiResponse(200, tweetWithLikes, "Tweet published successfully")
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    const match = {}

    if (query) {
        match.content = { $regex: query, $options: "i" }
    }

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        match.owner = new mongoose.Types.ObjectId(userId)
    }

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
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            
            $addFields: {
                owner: { $first: "$owner" }
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes"
            }
        },
        {
            $addFields: {
                totalLikes: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            // remove the raw likes array — frontend doesn't need it
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

    const tweets = await Tweet.aggregatePaginate(Tweet.aggregate(pipeline), options)

    return res.status(200).json(
        new ApiResponse(200, tweets, "Tweets fetched successfully")
    )
})

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    const { title, content } = req.body
    const mediaLocalPath = req.file?.path

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweetId")
    }

    if (!title && !content) {
        throw new ApiError(400, "Provide title or content to update")
    }

    let updateFields = {}

    if (title) updateFields.title = title
    if (content) updateFields.content = content

    if (mediaLocalPath) {
        const media = await uploadOnCloudinary(mediaLocalPath)
        updateFields.media = media.url
    }

    const updatedTweet = await Tweet.findOneAndUpdate(
        {
            _id: tweetId,
            owner: req.user._id
        },
        {
            $set: updateFields
        },
        { new: true }   // ← correct Mongoose option (returnDocument:"after" is MongoDB driver syntax, not Mongoose)
    )

    if (!updatedTweet) {
        throw new ApiError(404, "Tweet not found or unauthorized")
    }

    // Fetch updated tweet WITH like data so frontend gets consistent shape
    // preserves existing totalLikes + isLiked after edit
    const tweetWithLikes = await getTweetWithLikes(tweetId, req.user._id)

    res.status(200).json(
        new ApiResponse(200, tweetWithLikes, "Tweet updated successfully")
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweetId")
    }

    const deletedTweet = await Tweet.findOneAndDelete({
        _id: tweetId,
        owner: req.user._id
    })

    if (!deletedTweet) {
        throw new ApiError(404, "Tweet not found or unauthorized")
    }

    res.status(200).json(
        new ApiResponse(200, {}, "Tweet deleted successfully")
    )
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
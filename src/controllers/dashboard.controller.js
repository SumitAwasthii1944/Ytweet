import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import { Tweet } from "../models/tweet.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/likes.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const channelId=req.user._id

    const videoStats=await Video.aggregate([
        {
            $match:{
                owner:new mongoose.Types.ObjectId(channelId)//iss owner ke video documents nikal liye
            }
        },
        {
            $lookup:{//ye likes ke liye krna pda qki uska count directly store nhi kiya h
                from:"likes",
                localField:"_id",
                foreignField:"video",
                as:"likes"
            }
        },
        {
            $group:{//$group is one of the most important stages in the MongoDB aggregation pipeline in MongoDB.
            //  It is used to group documents together and perform calculations on them (like sum, count, average, etc.).
                _id:null,//group everything together
                totalVideos:{$sum:1},
                totalViews:{$sum:"$views"},//there is a definite no. defined in schema , so we directly add 10+200+300
                totalLikes:{$sum:{$size:"$likes"}}//since like is an array ,there is not a definite no. of likes per video it is a seperate schema
            }
        }
    ])

    const totalSubscribers=await Subscription.countDocuments({
        channel:channelId
    })

    const stats={
        totalVideos: videoStats[0]?.totalVideos || 0,
        totalViews: videoStats[0]?.totalViews || 0,
        totalLikes: videoStats[0]?.totalLikes || 0,
        totalSubscribers
    }

    return res.status(200).json(
        new ApiResponse(200, stats, "Channel stats fetched successfully")
    )
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // Get all the videos uploaded by the channel
    const channelId=req.user._id;
    const channelVideos =await Video.aggregate([
        {
            $match:{
                owner:new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"video",
                as:"likes"
            }
        },
        {
            $addFields:{
                likesCount:{$size:"$likes"}
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                views: 1,
                duration: 1,
                createdAt: 1,
                isPublished: 1,
                likesCount: 1
            }
        },
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,channelVideos,"channel videos fetched successfully")
    )
})

const getChannelTweets =asyncHandler(async (req,res) => {
    const channelId = req.user._id
    const channelTweets=await Tweet.aggregate([
        {
            $match:{
                owner:new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"tweet",
                as:"likes"
            }
        },
        {
            $addFields:{
                likesCount:{$size:"$likes"}
            }
        },
        {
            $project:{
                media: 1,
                title: 1,
                content: 1,
                createdAt: 1,
                likesCount: 1,
            }
        }
    ])
    return res
    .status(200)
    .json(
        new ApiResponse(200,channelTweets,"channel tweets fetched successfully")
    )
})
export {
    getChannelStats, 
    getChannelVideos,
    getChannelTweets
}
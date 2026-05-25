import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // toggle subscription
    if(!mongoose.Types.ObjectId.isValid(channelId)){
          throw new ApiError(400,"invalid channelId")
    }
    if (req.user._id.toString() === channelId) {
        throw new ApiError(400, "You cannot subscribe to yourself")
    }

    const unsubscribed = await Subscription.findOneAndDelete(
          {
                    channel:channelId,
                    subscriber:req.user._id
          }
    )

        // In toggleSubscription controller:
        if (unsubscribed) {
            return res.status(200).json(
                new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully")
            )
        }

        const subscribed = await Subscription.create({ channel: channelId, subscriber: req.user._id })

        if (subscribed) {
            return res.status(200).json(
                new ApiResponse(200, { subscribed: true }, "Subscribed successfully")
            )
        }

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid channelId")
    }
    const subscribers = await Subscription.aggregate([
          {
                    $match:{
                              channel:new mongoose.Types.ObjectId(channelId)
                    }
          },
          {
                    $lookup:{
                              from:"users",
                              localField:"subscriber",
                              foreignField:"_id",
                              as:"subscribers"
                    }
          },
          {
                    $unwind:"$subscribers"
          },
          {
                    $replaceRoot:{newRoot:"$subscribers"}
          },
          {
            $project:{
                fullName:1,
                username:1,
                avatar:1,
                email:1
            }
          }

    ])
    return res.status(200).json(
        new ApiResponse(200, subscribers, "Subscribers fetched successfully")
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if (!mongoose.Types.ObjectId.isValid(subscriberId)) {
        throw new ApiError(400, "Invalid subscriberId")
    }
    const channels = await Subscription.aggregate([
          {
                    $match:{
                              subscriber:new mongoose.Types.ObjectId(subscriberId)
                    }
          },
          {
                    $lookup:{
                              from:"users",
                              localField:"channel",
                              foreignField:"_id",
                              as:"subscribedChannels"
                    }
          },
          {
                    $unwind:"$subscribedChannels"
          },
          {
                    $replaceRoot:{newRoot:"$subscribedChannels"}
          },
          {
            $project:{
                fullName:1,
                username:1,
                avatar:1,
                email:1
            }
          }
    ])
    
    return res.status(200).json(
        new ApiResponse(200, channels, "Subscribed channels fetched successfully")
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
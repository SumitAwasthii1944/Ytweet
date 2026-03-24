import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/likes.model.js"
import { Video } from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"
import {Tweet} from "../models/tweet.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    if(!mongoose.Types.ObjectId.isValid(videoId)){
          throw new ApiError(400,"not a valid videoId")
    }
    // This hits the VIDEOS collection
      // A commentId will NOT be found there → throws 404
      const video = await Video.findById(videoId)
      if (!video) {
      throw new ApiError(404, "Video not found")  // ✅ stops execution here
      }
    const liked=await Like.findOneAndDelete({
          video:videoId,
          likedBy:req.user._id
    })

    if(liked){
          return res.status(200).json(
                    new ApiResponse(200,{},"video unliked")
          )
    }

    await Like.create({
          video:videoId,
          likedBy:req.user._id
    })

    return res.status(200).json(
        new ApiResponse(200, {}, "Video liked")
    )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
          if (!mongoose.Types.ObjectId.isValid(commentId)) {
                    throw new ApiError(400, "Invalid commentId")
          }
          const comment = await Comment.findById(commentId)

            if (!comment) {
            throw new ApiError(404, "Comment not found")
            }

          const like = await Like.findOneAndDelete({
                    comment: commentId,
                    likedBy: req.user._id
          })

          if (like) {
                    return res.status(200).json(
                              new ApiResponse(200, {}, "Comment unliked")
                    )
          }

          await Like.create({
                    comment: commentId,
                    likedBy: req.user._id
          })

          return res.status(200).json(
                    new ApiResponse(200, {}, "Comment liked")
          )

})

const toggleTweetLike = asyncHandler(async (req, res) => {
      //TODO: toggle like on tweet
          const { tweetId } = req.params

          if (!mongoose.Types.ObjectId.isValid(tweetId)) {
                    throw new ApiError(400, "Invalid tweetId")
          }

          const tweet = await Tweet.findById(tweetId)
            if (!tweet) {
            throw new ApiError(404, "Tweet not found")
            }

          const like = await Like.findOneAndDelete({
                    tweet: tweetId,
                    likedBy: req.user._id
          })

          if (like) {
          return res.status(200).json(
                    new ApiResponse(200, {}, "Tweet unliked")
          )
          }

          await Like.create({
                    tweet: tweetId,
                    likedBy: req.user._id
          })

          return res.status(200).json(
                    new ApiResponse(200, {}, "Tweet liked")
          )
})

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const userId=req.user._id
    
    const likedVideos=await Like.aggregate([
          {
               $match:{
                  likedBy:new mongoose.Types.ObjectId(userId),
                  video: { $ne: null }//ensure it is a video like

               }
          },
          {
            $lookup:{
               from:"videos",
               localField:"video",//field in like collection
               foreignField:"_id",//mongoDB will match Like.video  ===  Videos._id
               as:"likedVideos"
            }
          },
          {
            $unwind: "$likedVideos"//converts array to object of objects
          },
          {
            $replaceRoot:{newRoot:"$likedVideos"}//Return only video object instead of like document.
          }
    ])
    return res.status(200).json(
      new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    )

})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}
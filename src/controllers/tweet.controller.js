import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { title, content } = req.body

    if (!title || !content) {
        throw new ApiError(400, "Title and content are required")
    }
    const mediaPath =req.file?.path
    const tweetMedia = mediaPath ? await uploadOnCloudinary(mediaPath) : null

    const newTweet = await Tweet.create({
        title,
        content,
        media: tweetMedia?.url || null,
        owner: req.user._id  // ✅ add owner
    })

    return res.status(200).json(
          new ApiResponse(200,newTweet,"tweet publlished successfully")
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
        const {page = 1,limit=10,query,sortBy,sortType,userId} =req.query
        const match={}

        if(query){
                match.content = {$regex:query, $options:"i"}//i means case-insensitive
        }

        if(userId && mongoose.Types.ObjectId.isValid(userId)){
            match.owner = new mongoose.Types.ObjectId(userId)
        }

        const sortOptions = {}

        if(sortBy){
            sortOptions[sortBy] = sortType === "asc" ? 1 : -1
        }else{
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
                    foreignField: "tweet",
                    as: "likes"
                }
            },
            {
                $addFields: {
                    totalLikes: { $size: "$likes" },
                    isLiked: {
                        $cond: {
                            if: { $in: [req.user?._id, "$likes.likedBy"] },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $sort: sortOptions
            }
        ]

        const options={
                page:parseInt(page),
                limit:parseInt(limit)
        }

        const tweets= await Tweet.aggregatePaginate(Tweet.aggregate(pipeline),options)

        return res.status(200).json(
                new ApiResponse(200,tweets,"tweets fetched succesfully")
        )
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const {tweetId} = req.params
    const {title,content} =req.body
    const mediaLocalPath=req.file?.path

    if(!mongoose.Types.ObjectId.isValid(tweetId)){
        throw new ApiError(400,"invalid tweetId")
    }

    if(!title && !content){
        throw new ApiError(401,"provide title or content")
    }

    let updateFields={
        title,
        content
    }

    if(mediaLocalPath){
        const media=await uploadOnCloudinary(mediaLocalPath)
        updateFields.media=media.url
    }

    const updatedTweet= await Tweet.findOneAndUpdate(
        {
            _id:tweetId,
            owner:req.user._id
        },
        {
            $set:updateFields
        },
        {returnDocument: "after"}
    )

    if(!updatedTweet){
        throw new ApiError(404,"tweet not found or unauthorized")
    }

    res.status(200).json(
        new ApiResponse(200,updatedTweet,"tweet updated successfully")
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const {tweetId} = req.params

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweetId")
    }

    const deletedTweet=await Tweet.findOneAndDelete({
        _id: tweetId,
        owner: req.user._id
    })

    if(!deletedTweet){
        throw new ApiError(404,"tweet not found or unauthorized")
    }

    res.status(200).json(
        new ApiResponse(200,deletedTweet,"tweet deleted successfully")
    )
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
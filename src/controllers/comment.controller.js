import mongoose, {isValidObjectId} from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query
    const pipeline =[
        {
            $match:{
                video:new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"comment",
                as:"Likes"
            }
        },
        {
            $addFields:{
                likesCount: { $size: "$Likes" }
            }
        }
    ]

    const options={
        page:parseInt(page),
        limit:parseInt(limit)
    }

    const comments = await Comment.aggregatePaginate(
        Comment.aggregate(pipeline),
        options
    )

    if(!comments.docs.length){//return a doc which contains an array
        throw new ApiError(400,"no comments found")
    }
    return res.status(200).json(
        new ApiResponse(200,comments,"video comments fetched successfully")
    )
})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} =req.params
    const {content}=req.body

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"invalid videoId")
    }
    if(!content){
        throw new ApiError(400,"Content is required")
    }
    const comment = await Comment.create(
        {
            content:content,
            video:videoId,
            owner:req.user._id
        }
    )
    if(!comment){
        throw new ApiError(400,"cannot comment or unauthorized")
    }
    return res.status(200).json(
        new ApiResponse(200,comment,"commented successfully")
    )
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentId} =req.params
    const {content}=req.body

    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400,"invalid commentId")
    }
    if (!content || content.trim() === "") {
        throw new ApiError(400, "Content is required")
    }
    const comment = await Comment.findOneAndUpdate(
        {
            _id:commentId,
            owner:req.user._id,
        },
        {
            $set:{
                content:content
            }
        },
        {
            new:true
        }
    )
    if(!comment){
        throw new ApiError(400,"cannot comment or unauthorized")
    }
    return res.status(200).json(
        new ApiResponse(200,comment,"commented updated successfully")
    )
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const {commentId} =req.params

    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400,"invalid commentId")
    }

    const deletedComment = await Comment.findOneAndDelete(
        {
            _id:commentId,
            owner:req.user._id,
        }
    )
    if(!deletedComment){
        throw new ApiError(400,"cannot delete comment or unauthorized")
    }
    return res.status(200).json(
        new ApiResponse(200,deletedComment,"commented deleted successfully")
    )
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}
import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

// Reusable pipeline to fetch a single comment WITH likesCount + isLiked
// Used by addComment and updateComment so they return the same shape
// as getVideoComments — frontend always gets consistent data
const getCommentWithLikes = async (commentId, userId) => {
    const result = await Comment.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(commentId) }
        },
        // populate owner details
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
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
                }
            }
        },
        {
            $project: { likes: 0 }  // remove raw likes array
        }
    ])

    return result[0]
}


const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    const pipeline = [
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        // populate owner (user) details so frontend gets owner.fullName/username/avatar
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
            }
        },
        {
            $addFields: {
                likesCount: { $size: "$likes" },
                //added isLiked — was missing, needed by commentSlice cross-slice sync
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
            //remove raw likes array — wasn't projected out before
            // also keep owner fields intact; remove raw likes
            $project: { likes: 0 }
        }
    ]

    const options = {
        page: parseInt(page),
        limit: parseInt(limit)
    }

    const comments = await Comment.aggregatePaginate(
        Comment.aggregate(pipeline),
        options
    )

    // empty comments is not an error — just return empty array
    // throwing 400 when a video has no comments breaks the UI
    return res.status(200).json(
        new ApiResponse(200, comments, "Video comments fetched successfully")
    )
})

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }
    if (!content) {
        throw new ApiError(400, "Content is required")
    }

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user._id
    })

    if (!comment) {
        throw new ApiError(400, "Cannot comment or unauthorized")
    }

    //fetch with likesCount + isLiked so frontend gets consistent shape
    // likesCount = 0, isLiked = false for a brand new comment
    const commentWithLikes = await getCommentWithLikes(comment._id, req.user._id)

    return res.status(200).json(
        new ApiResponse(200, commentWithLikes, "Commented successfully")
    )
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new ApiError(400, "Invalid commentId")
    }
    if (!content || content.trim() === "") {
        throw new ApiError(400, "Content is required")
    }

    const comment = await Comment.findOneAndUpdate(
        {
            _id: commentId,
            owner: req.user._id,
        },
        {
            $set: { content }
        },
        { new: true }
    )

    if (!comment) {
        throw new ApiError(400, "Cannot update comment or unauthorized")
    }

    // with likesCount + isLiked so frontend gets consistent shape
    // preserves existing likesCount + isLiked after edit
    const commentWithLikes = await getCommentWithLikes(commentId, req.user._id)

    return res.status(200).json(
        new ApiResponse(200, commentWithLikes, "Comment updated successfully")
    )
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new ApiError(400, "Invalid commentId")
    }

    const deletedComment = await Comment.findOneAndDelete({
        _id: commentId,
        owner: req.user._id,
    })

    if (!deletedComment) {
        throw new ApiError(400, "Cannot delete comment or unauthorized")
    }
    return res.status(200).json(
        new ApiResponse(200, { deletedId: deletedComment._id }, "Comment deleted successfully")
    )
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}
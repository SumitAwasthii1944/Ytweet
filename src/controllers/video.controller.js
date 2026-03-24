import mongoose,{isValidObjectId} from 'mongoose'
import {Video} from '../models/video.model.js'
import {User} from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'

const getAllVideos=asyncHandler(async (req,res) => {
          //sbse phle hmne saara data liya url se
          // When writing this controller, the thinking is:
          // User may search videos
          // User may filter by channel
          // User may sort videos
          // Results must be paginated
          //aggregate() lets you combine all these in one pipeline.

          const {page = 1,limit=10,query,sortBy,sortType,userId} =req.query
          const match={}

          if(query){
                    match.title = {$regex:query, $options:"i"}//i means case-insensitive
          }

          if(userId){
                    match.owner=new mongoose.Types.ObjectId(userId)
          }

          match.isPublished=true

          const sortOptions = {}

          if(sortBy){
            sortOptions[sortBy] = sortType === "asc" ? 1 : -1
          }else{
            sortOptions.createdAt = -1
          }


          const pipeline=[
                    {
                        $match:match
                    },
                    {
                        $sort:sortOptions
                    }
          ]

          const options={
                    page:parseInt(page),
                    limit:parseInt(limit)
          }

          const videos= await Video.aggregatePaginate(Video.aggregate(pipeline),options)

          return res.status(200).json(
                    new ApiResponse(200,videos,"videos fetched succesfully")
          )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
    if(!title || !description){
          throw new ApiError(400,"title and description are required")
    }
    const videoLocalPath=req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath=req.files?.thumbnail?.[0]?.path
    if(!videoLocalPath){
        throw new ApiError(400,"video file is required")
    }
    if(!thumbnailLocalPath){
        throw new ApiError(400,"thumbnail file is required")
    }
    const video = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if (!video?.url) {
        throw new ApiError(400, "Error uploading video")
    }

    if (!thumbnail?.url) {
        throw new ApiError(400, "Error uploading thumbnail")
    }

    const newVideo = await Video.create({
        videoFile:video.url,
        thumbnail:thumbnail.url,
        title,
        description,
        duration:video.duration || 0,
        owner:req.user._id
    })
    return res.status(200).json(
        new ApiResponse(200, newVideo, "Video published successfully")
    )

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video Id")
    }
    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: { views: 1 }
        },
        { new: true }
    )
    if(!video){
        throw new ApiError(404,"video not found")
    }

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $addToSet: { watchHistory: videoId }//addtoset avoids duplicates in the array, same user is counted only once whereas $push insert duplicates
        }
    )

    res.status(200).json(
        new ApiResponse(200,video,"video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title , description} =req.body
    const thumbnailLocalPath = req.file?.path
    //TODO: update video details like title, description, thumbnail
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video Id")
    }

    let updateFields={
        title,
        description
    }

    if(thumbnailLocalPath){
        const thumbnail= await uploadOnCloudinary(thumbnailLocalPath)
        updateFields.thumbnail=thumbnail.url
    }

    const updatedVideo = await Video.findOneAndUpdate(
        {
            _id: videoId,
            owner: req.user._id
        },
        {
            $set:updateFields
        },
        {new:true}   
    )
    if(!updatedVideo){
        throw new ApiError(404,"Video not found or unauthorized")
    }
    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video updated successfully")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if(!videoId){
        throw new ApiError(400,"videoId not found")
    }
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video Id")
    }
    const deletedVideo=await Video.findOneAndDelete({
        _id:videoId,
        owner:req.user._id
    })
    if(!deletedVideo){
        throw new ApiError(404,"Video not found or unauthorized")
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Video deleted successfully")
    )

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    // Get videoId from params
    // Validate the ID
    // Ensure the logged-in user owns the video
    // Flip (toggle) the value of isPublished
    // Return the updated video
    const { videoId } = req.params
      if(!videoId){
        throw new ApiError(400,"videoId not found")
    }
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video Id")
    }
    const video=await Video.findOne({
        _id:videoId,
        owner:req.user._id
    })
    if(!video){
        throw new ApiError(404,"video not found")
    }
    video.isPublished=!video.isPublished
    await video.save()

    return res.status(200).json(
        new ApiResponse(200, video, "Publish status toggled successfully")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
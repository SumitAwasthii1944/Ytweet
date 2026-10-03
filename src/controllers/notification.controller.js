import mongoose from "mongoose"
import { Notification } from "../models/notification.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getNotifications = asyncHandler(async (req, res) => {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(
        Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
        50
    )

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find({ recipient: req.user._id })
            .populate("actor", "fullName username avatar")
            .populate({
                path: "comment",
                select: "content video owner parentComment",
                populate: {
                    path: "parentComment",
                    select: "content video owner",
                },
            })
            .populate("video", "title thumbnail owner")
            .populate("tweet", "title content owner")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Notification.countDocuments({ recipient: req.user._id }),
        Notification.countDocuments({ recipient: req.user._id, read: false }),
    ])

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                docs: notifications,
                page,
                limit,
                totalDocs: total,
                totalPages: Math.ceil(total / limit),
                unreadCount,
            },
            "Notifications fetched successfully"
        )
    )
})

const markNotificationAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new ApiError(400, "Invalid notificationId")
    }

    const notification = await Notification.findOneAndUpdate(
        {
            _id: notificationId,
            recipient: req.user._id,
        },
        { $set: { read: true } },
        { new: true }
    )

    if (!notification) {
        throw new ApiError(404, "Notification not found")
    }

    return res.status(200).json(
        new ApiResponse(200, notification, "Notification marked as read")
    )
})

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
        {
            recipient: req.user._id,
            read: false,
        },
        { $set: { read: true } }
    )

    return res.status(200).json(
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount },
            "Notifications marked as read"
        )
    )
})

export {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
}

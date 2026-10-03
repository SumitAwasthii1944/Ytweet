import mongoose, { Schema } from "mongoose"

const notificationSchema = new Schema(
    {
        recipient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        actor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: [
                "comment_like",
                "comment_reply",
                "video_like",
                "tweet_like",
                "video_comment",
            ],
            required: true,
        },
        comment: {
            type: Schema.Types.ObjectId,
            ref: "Comment",
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
        },
        tweet: {
            type: Schema.Types.ObjectId,
            ref: "Tweet",
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
)

notificationSchema.index({ recipient: 1, createdAt: -1 })

export const Notification = mongoose.model("Notification", notificationSchema)

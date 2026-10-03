import { Router } from "express"
import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from "../controllers/notification.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.use(verifyJWT)

router.get("/", getNotifications)
router.patch("/:notificationId/read", markNotificationAsRead)
router.patch("/read-all", markAllNotificationsAsRead)

export default router

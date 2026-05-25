import {Router} from "express"
import { loginUser, registerUser,refreshAccessToken, changeCurrentPassword,getUserChannelProfile ,getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getWatchHistory,searchUsers } from "../controllers/user.controller.js"
import {upload} from "../middlewares/multer.middleware.js"
import { logoutUser } from "../controllers/user.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.route("/register").post(
          upload.fields([//
                    {
                              name:"avatar",
                              maxCount:1
                    },
                    {
                              name:"coverImage",
                              maxCount:1
                    }
          ]),
          registerUser
)
router.route("/login").post(loginUser) 
//secured Routes
router.route("/logout").post(verifyJWT,logoutUser)//verifyJWT middleware use krne ki wjh se hm logoutUser function me req.user ko access kr paenge
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT,changeCurrentPassword)
router.route("/current-user").get(verifyJWT,getCurrentUser)
router.route("/update-account").patch(verifyJWT,updateAccountDetails)
router.route("/avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar)
router.route("/search").get(searchUsers)
router.route("/cover-image").patch(verifyJWT,upload.single("coverImage"),updateUserCoverImage)
router.route("/c/:username").get(verifyJWT,getUserChannelProfile)//qki req.params use kiya tha
router.route("/history").get(verifyJWT,getWatchHistory)
export default router
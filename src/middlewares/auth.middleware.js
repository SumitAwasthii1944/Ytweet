import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import {User} from "../models/user.model.js"
import redis from "../utils/redis.js";

export const verifyJWT=asyncHandler(async (req,res,next) => {
          try {
                    const token=req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
          
                    if(!token){
                              throw new ApiError(401,"Unauthorized request")
                    }
          
                    const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
                    
                    const sessionKey = `session:${decodedToken.sid}`;
                    const cachedSession = await redis.get(sessionKey);

                    // Redis session must exist for this access token to stay valid
                    if (!cachedSession) {
                              throw new ApiError(401, "Session expired or logged out");
                    }

                    const user=await User.findById(decodedToken?._id).select("-password -refreshToken")
          
                    if(!user){
          
                              throw new ApiError(401,"invalid access token")
                    }
          
                    req.user=user;
                    req.user.sessionId = decodedToken.sid; // keep current device session id for logout
                    next();
          } catch (error) {
                    throw new ApiError(401, error?.message || "invalid access token" )
          }
})
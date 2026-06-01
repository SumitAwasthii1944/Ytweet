import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
const generateAccessAndRefreshTokens = (async (userId) => {
          try {
                    const user=await User.findById(userId)
                    const accessToken=user.generateAccessToken();
                    const refreshToken=user.generateRefreshToken();
                    user.refreshToken=refreshToken;
                    user.accessToken=accessToken;
                    await user.save({validateBeforeSave:false})//we dont need to validate password and username here because we checked it earlier

                    return {accessToken,refreshToken}
          } catch (error) {
                    throw new ApiError(500,"something went wrong while generating tokens")
          }
})

// Google OAuth handler (uses ID token from client)
// creates a user if needed, and then re-uses the existing token/cookie mechanism
// used by regular login (so the rest of the app doesn't need to change).
const googleAuth = asyncHandler(async (req, res) => {
    // The frontend sends a Google ID token (JWT) after a successful client-side sign-in.
    // We verify it with Google's tokeninfo endpoint and extract the user's profile.
    const { idToken } = req.body;
    if (!idToken) throw new ApiError(400, "idToken is required");

    // Verify token with Google - this returns a JSON profile for the token.
    // You can also verify the token using Google libraries, but tokeninfo is simple
    // and sufficient for this flow where the client already performed the sign-in.
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const profile = await verifyRes.json();

    // tokeninfo returns 'email_verified' as string 'true'/'false'. If not verified,
    // deny the request. This ensures the email actually belongs to the user.
    if (profile.error_description || profile.email_verified !== 'true') {
        throw new ApiError(401, "Invalid Google token");
    }

    // Extract useful profile fields
    const email = profile.email;
    const fullName = profile.name || email.split("@")[0];
    const avatarUrl = profile.picture || "";

    // Find an existing user by email. If none exists, create one so the Google user
    // can access the same app functionality as regular accounts.
    let user = await User.findOne({ email });

    if (!user) {
        // Generate a safe username from the email/local-part and ensure uniqueness.
        let baseUsername = (email.split("@")[0] || fullName.split(" ")[0]).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!baseUsername) baseUsername = `user${Date.now()}`;// fallback username if email/local-part doesn't yield a valid username
        let username = baseUsername;
        let counter = 0;
        while (await User.findOne({ username })) {// check if username already exists and if it does, append a counter until we find a unique one
            counter++;
            username = `${baseUsername}${counter}`;
        }

        // We set a random password because the user will primarily sign-in with Google.
        // The password field is required by the schema; keeping a random value avoids
        // changing the existing signup flow.
        const randomPassword = Math.random().toString(36).slice(-12);// -12 means we want a 12 character long random string

        user = await User.create({
            fullName,
            avatar: avatarUrl || "",
            coverImage: "",
            email,
            password: randomPassword,
            username
        });
    }

    // Reuse existing token generation so frontend receives the same response shape
    // as standard login. This helps keep the rest of the app unchanged.
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // Cookie options mirror existing login logic. Note: secure:true requires HTTPS.
    const options = {
        httpOnly: true,
        secure: true
    };

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in via Google")
        );
});

const registerUser=asyncHandler( async (req,res) => {

          // get user details from frontend
          //validation - not empty
          // check if user already exists
          //check for images, check for avatar
          //upload them to cloudinary,avatar
          //create user object - create entry in db
          //remove password and refresh token field from response
          //check for user creation
          //return res
          // console.log("BODY:", req.body);
          // console.log("FILES:", req.files);

          const {fullName , email, username,password} =req.body
          //console.log("email: ",email)
          // if(fullName === ""){
          //           throw new ApiError(400,"fullname is required")
          // }saare alg alg bhi check kr skte hain
          if(
                    [fullName,email,username,password].some((field) => //ye check krne ke liye ki field empty to nahi hai aur isme trim() method ka use krke ye bhi check krne ke liye ki field me sirf spaces to nahi hai
                    field?.trim() === "")
          ){
                   throw new ApiError(400,"All fields are required") 
          }
          const existedUser=await User.findOne({
                    $or:[{username},{email}]//jo isse match krega wo mil jaega
          })

          if(existedUser){
                    throw new ApiError(409,"User with email or username already exist")
          }

          
          //const coverImageLocalPath=req.files?.coverImage?.[0]?.path;
          let coverImageLocalPath;
          if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
                    coverImageLocalPath=req.files.coverImage[0].path
          }

          const avatarLocalPath = req.files?.avatar?.[0]?.path//.files is provided by multer 
          if(!avatarLocalPath){
                    throw new ApiError(400,"Avatar file is required")
          }

          const avatar=await uploadOnCloudinary(avatarLocalPath)
          const coverImage=await uploadOnCloudinary(coverImageLocalPath)

          if(!avatar){
                    throw new ApiError(400,"avatar file is required")
          }

          const user=await User.create({
                    fullName,
                    avatar:avatar.url,
                    coverImage:coverImage?.url || "",
                    email,
                    password,
                    username:username.toLowerCase()
          })
          const createdUser=await User.findById(user._id).select(
                    "-password -refreshToken"//select() is used to specify which fields should be included or excluded in the result. In this case, it is used to exclude the password and refreshToken fields from the user document that is returned in the response. This is done for security reasons, as these fields contain sensitive information that should not be exposed to the client.
          )
          if(!createdUser){
                    throw new ApiError(500,"something went wrong while registering the user")
          }
          return res.status(201).json(
                    new ApiResponse(200,createdUser,"user registered successfully")
          )
})        

const loginUser =asyncHandler(async (req,res) => {
          //req body se data le aao
          //username or email
          //find a user
          //password check?
          //generate access and refresh token
          //send cookie
          const {email,username,password} =req.body;
          if(!(username || email)){//koi ek ho ya tm jisse login karana chaho
                    throw new ApiError(400,"username or password is required")
          }
          const user=await User.findOne({
                    $or:[{username},{email}]//ya to same email wala mile ya username 
          })

          if(!user){
                    throw new ApiError(404,"User not found")
          }

          const isPasswordValid=await user.isPasswordCorrect(password);//we made this method
          if(!isPasswordValid){
                    throw new ApiError(401,"wrong password")
          }

          const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id);

          const loggedInUser= await User.findById(user._id).select("-password -refreshToken")

          const options ={//only modifiable by server
                    httpOnly:true,
                    secure:true
          }
          

          return res.status(200)
          .cookie("accessToken",accessToken,options)
          .cookie("refreshToken",refreshToken,options)
          .json(
                    new ApiResponse(200,{
                              user:loggedInUser,accessToken,refreshToken//yhn issliye acces refresh send kiye qki ky pta user token localStorage me save krna chahta ho
                    },"user Logged in successfully")
          )
})
const searchUsers = asyncHandler(async (req, res) => {
    const { query } = req.query

    if (!query) throw new ApiError(400, "Query is required")

    const users = await User.find({
        $or: [
            { username: { $regex: query, $options: "i" } },
            { fullName: { $regex: query, $options: "i" } }
        ]
    }).select("-password -refreshToken -watchHistory")

    return res.status(200).json(
        new ApiResponse(200, users, "Users fetched successfully")
    )
})

const logoutUser = asyncHandler(async (req,res) => {
          //refersh token ko database se gyb kr do
          await User.findByIdAndUpdate(
                    req.user._id,
                    {
                        $unset:{
                                refreshToken:1//this removes the field from document
                        }
                    },
                    { new:true }

          )

          const options={
                    httpOnly:true,
                    secure:true
          }
          return res
          .status(200)
          .clearCookie("accessToken",options)//from cookie-parser library
          .clearCookie("refreshToken",options)
          .json(new ApiResponse(200,{},"User logged out"))
})
const refreshAccessToken= asyncHandler(async (req,res) => {
          const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

          if(!incomingRefreshToken){
                    throw new ApiError(401,"unauthorized request")
          }
          try {
                    const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
                    const user=await User.findById(decodedToken?._id)
          
                    if(!user){
                              throw new ApiError(401,"inavlid refersh token")
                    }
                    if(incomingRefreshToken !==user?.refreshToken){
                              throw new ApiError(401,"refresh token is expired or used")
                    }
          
                    const options={
                              httpOnly:true,
                              secure:true
                    }
          
                    const {accessToken,refreshToken: newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
          
                    return res
                    .status(200)
                    .cookie("accessToken",accessToken,options)
                    .cookie("refreshToken",newRefreshToken,options)
                    .json(
                              new ApiResponse(
                                        200,
                                        {accessToken,refreshToken:newRefreshToken},
                                        "Access token refreshed"
                              )
                    )
          } catch (error) {
                    throw new ApiError(401,error?.message || "Invalid refresh token")
          }
})

const changeCurrentPassword =asyncHandler(async (req,res) => {
          // make sure payload contains both passwords and log for debugging
          const {oldPassword,newPassword} = req.body || {};
          // you could remove the console.log in production
          console.log("changeCurrentPassword payload", { oldPassword, newPassword });

          if (!oldPassword || !newPassword) {
                    throw new ApiError(400, "oldPassword and newPassword are required");
          }

          const user = await User.findById(req.user?._id);
          if (!user) {
                    throw new ApiError(404, "User not found");
          }

          const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
          if (!isPasswordCorrect) {
                    // either the value is wrong or it wasn't sent at all
                    throw new ApiError(400, "Invalid old password");
          }

          user.password = newPassword;
          await user.save({validateBeforeSave:false});

          return res.status(200).json(
                    new ApiResponse(200, {}, "password changed successfully")
          );
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "Current user fetched successfully")
        )
})

const updateAccountDetails = asyncHandler( async (req,res) => {
          const {fullName, email}=req.body
          if(!fullName || !email){
                    throw new ApiError(400,"all fields are required")
          }

          const user=await User.findByIdAndUpdate(
                    req.user?._id,
                    {
                              $set:{
                                        fullName,
                                        email:email
                              }
                    },
                    {new:true}//updtae hone ke baad jo info hoti h wo return hoti h
          ).select("-password ")

          return res
          .status(200)
          .json(new ApiResponse(200,user,"Account details updated successfully"))
})
//files ko update krne ke liye alg controller likhna chaiye(mtlb alg function )

const updateUserAvatar = asyncHandler(async (req,res) => {
          const avatarLocalPath=req.file?.path

          if(!avatarLocalPath){
                    throw new ApiError(400,"Avatar file is missing")
          }
          const avatar=await uploadOnCloudinary(avatarLocalPath)

          if(!avatar.url){
                    throw new ApiError(400,"Error while uploading on avatar")
          }
          //delete old avatar after changing the avatar
          const user=await User.findByIdAndUpdate(
                    req.user?._id,
                    {
                          $set:{
                              avatar:avatar.url
                          }    
                    },
                    {new:true}
          ).select("-password")
          return res
          .status(200)
          .json(
                    new ApiResponse(200,user,"Avatar updated successfully")
          )
})
const updateUserCoverImage = asyncHandler(async (req, res) => {
          const coverImageLocalPath=req.file?.path

          if(!coverImageLocalPath){
                    throw new ApiError(400,"cover Image file is missing")
          }
          const coverImage=await uploadOnCloudinary(coverImageLocalPath)

          if(!coverImage.url){
                    throw new ApiError(400,"Error while uploading on coverImage")
          }

          const user=await User.findByIdAndUpdate(
                    req.user?._id,
                    {
                          $set:{
                              coverImage:coverImage.url
                          }    
                    },
                    {new:true}
          ).select("-password")
          return res
          .status(200)
          .json(
                    new ApiResponse(200,user,"Cover image updated successfully")
          )
})

const getUserChannelProfile= asyncHandler(async (req,res) => {
    const {username} =req.params

    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel=await User.aggregate([//pipeline likhne ke baad return me arrays aate hain 
        {//first pipeline
            $match:{// jo channel ka username url se aaya hai usse match krna h database me jo username field me hai usse
                username:username?.toLowerCase()
            }
        },
        {//second pipeline
            $lookup:{
                from:"subscriptions",//model ka name lowecase me aur plural ho jaata h tbhi Subscription ko aise likha
                localField:"_id",//channel ka id
                foreignField:"channel",//channel ko select kiya to saare subscribers mil gye
                as:"subscribers"
            }
        },
        {//third pipeline
            $lookup:{
                from:"subscriptions",//model ka name lowecase me aur plural ho jaata h tbhi "Subscription" ko aise likha
                localField:"_id",
                foreignField:"subscriber",//subscriber ko select kiya to hme saare channels mil gye jinhe hmne subscribe kiya hai
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"//field ke liye $ use krte hain
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{//to show subscribe button (boolean) 
                    $cond:{
                        if:{$in:[new mongoose.Types.ObjectId(req.user?._id),"$subscribers.subscriber"]},//$in ye arrays aur object dono me dekh leta h // ye check krne ke liye ki kya current user subscribers ke subscriber field me hai ya nahi
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{//saari cheezein nhi dunga , sirf selected cheezein dunga
                fullName:1,//jin cheezein ko aage pass on krna h uska flag 1 kr do
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])
    if(!channel?.length){
        throw new ApiError(404,"channel does not exists")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully")
    )
})

const getWatchHistory=asyncHandler(async (req,res) => {
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)//aggregation pipelines me mongoose kaam nhi krta h,tbhi hm req.user._id nhi use kr skte 
            }
        },
        {
            $lookup:{//watch history me video ki details bhi chahiye to video collection se lookup krna padega
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[//
                    {
                        $lookup:{//video ke owner ki details bhi chahiye to user collection se lookup krna padega
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{//owner ke liye hmne sirf kuch fields select ki hain, baki fields ko exclude kr diya hai
                                        fullName:1,
                                        userName:1,
                                        avatar:1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{//seedhe owner object milega usme se owner. krke nikal lenge
                            owner:{
                                $first:"$owner"//owner array me se pehla element le lo, kyuki owner ke liye hmne $lookup me pipeline me $project use kiya tha to owner array me ek hi object hoga
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "watch history fetched successfully"
        )
    )
})

export {
          registerUser,
          loginUser,
          logoutUser,
          refreshAccessToken,
          getCurrentUser,
          getUserChannelProfile,
          changeCurrentPassword,
          updateAccountDetails,
          updateUserAvatar,
          updateUserCoverImage,
          getWatchHistory,
          searchUsers,
          googleAuth
}
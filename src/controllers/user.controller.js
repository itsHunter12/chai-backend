import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validationBeforeSave : false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating Access and Refresh Token.");
    }
}

const registerUser = asyncHandler ( async (req, res) => {
    const {fullName, email, username, password } = req.body
    //console.log("email ", email);

    if([fullName, email, username, password].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required");
    }

    const ExistedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    
    if(ExistedUser) {
        throw new ApiError(409, "User with email or username is already Exist")
    }
    //console.log(req.files);
    

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    //console.log("First Check", avatarLocalPath);
    
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path; 
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar is Required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    //console.log("Second Check", avatar);

    if(!avatar) {
        throw new ApiError(400, "Avatar is Required");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const CreatedUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!CreatedUser) {
        throw new ApiError(500, "Something wnet wrong while registering the User..")
    }

    return res.status(201).json(
        new ApiResponse(200, CreatedUser, "User registered Successfully.")
    )

})

// Todo list for login
// req body -> data,
// username/email verify
// find the user
// password check
// generate access and refresh token
// send tokens in cookies

const loginUser = asyncHandler ( async (req, res) => {

    const {username, email, password} = req.body

    if (!(username || email)){
        throw new ApiError(400,"username or password is required...")
    }

    const user = await User.findOne({
        $or : [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(402, "User does not Exist.")
    }
    
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User Credentials.")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged In Successfully."
        )
    )
})

const logoutUser = asyncHandler ( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken : undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "User Logged Out"))
})

const refreshAccessToken = asyncHandler( async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorised request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
        throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used.")
        }
    
        const options = {
            httpOnly : true,
            secure : true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken",newRefreshToken, options)
        .json(
            new ApiResponse(
                200, {accessToken, refreshToken : newRefreshToken}, "Access token refreshed."
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}
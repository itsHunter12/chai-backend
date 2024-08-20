import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export {registerUser}
import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave:false })

        return {accessToken,refreshToken}

    }catch(error){
        throw new ApiError(500,"Something Went Wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async(req,res)=>{
    console.log(req.body);
    //get details from frontend
    //validation - not empty
    //check if user already exists : username , email
    //check for images , check for avatar
    //upload them to cloudinary , avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation 
    //return res

    const {fullName, email,username , password} = req.body
    console.log(fullName);
    //console.log("email :- ",email);

    if(
        [fullName,email,username,password].some((field)=>field?.trim() === "")
    ){
        throw new ApiError(400,"All Fields are Required")
    }
    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }
    const user = await User.create({
        fullName,
        email,
        password,
        username: username.toLowerCase()
    })
    
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went Wrong While Registering the User")
    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User Registered Successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // Destructure the request body
    const { email, username, password } = req.body;

    // Check if username or email is provided
    if (!username && !email) {
        throw new ApiError(400, "Username or Email is Required");
    }

    // Find the user by username or email
    const user = await User.findOne({
        $or: [{ username }, { email }]
    });

    // Check if user exists
    if (!user) {
        throw new ApiError(404, "User does not Exist");
    }

    // Verify the password
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user Credentials");
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Select the user details to be sent back (excluding password and refreshToken)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // Options for cookies
    const options = {
        httpOnly: true,
        secure: true
    };

    // Set the cookies for access and refresh tokens
    res.cookie("accessToken", accessToken, options);
    res.cookie("refreshToken", refreshToken, options);

    // Redirect to the info page after login
    return res.redirect('/api/v1/users/info'); // Adjust the URL to your info page
});
//old code below

/*const loginUser = asyncHandler(async(req,res)=>{
    //req body -> data
    //username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie

    const {email,username,password} = req.body
    if(!username && !email){
        throw new ApiError(400,"Username Or Email is Required")
    }

    const user = await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"User does not Exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user Credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User Logged In Successfully"
        )
    )

})

*/

    const logoutUser = asyncHandler(async (req, res) => {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    refreshToken: undefined
                }
            },
            {
                new: true
            }
        );
    
        const options = {
            httpOnly: true,
            secure: true
        };
    
        // Clear the cookies
        res.clearCookie("accessToken", options);
        res.clearCookie("refreshToken", options);
    
        // Redirect to the login page
        return res.redirect('/api/v1/users/login'); // Adjust this URL if your login page has a different route
    });
//old code below
    /*const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User Logged Out")
    )
}) */
    
const refreshAccessToken= asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unathorized request")
    }

    try{
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh Token in Expired or Used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken:newRefreshToken},
                "Access token Refreshed"
            )
        )
    }catch(error){
        throw new ApiError(401,error?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"Password changed Successfully")
    )

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(200,req.user,"Current user fetched successfully")
    )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body

    if(!fullName || !email){
        throw new ApiError(400,"All Fields are Required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            //MongoDb Operators
            $set:{
                fullName:fullName,
                email: email
            }

        },
        {new:true} //Updated Data is returned
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Account details Updated Successfully"))
})

const getUserInfo = asyncHandler(async (req, res) => {
    const userDetails = await UserModel.findById(req.user._id); // Fetch user details from the database

    if (!userDetails) {
        return res.status(404).json({ message: "User not found" });
    }

    res.json({
        username: userDetails.username,
        email: userDetails.email,
        fullName: userDetails.fullName,
        finCoin: userDetails.finCoin,
        createdAt: userDetails.createdAt,
    });
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    getUserInfo,
}
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
    if (!req.body)
        throw new ApiError(400, "Saari fields chahiye bhai!");

    const { fullname, email, username, password } = req.body;

    // validating data
    if ([fullname, email, username, password].some((field) => (field?.trim() === "" || field?.trim() === undefined)))
        throw new ApiError(400, "Saari fields chahiye bhai!");

    const alreadyExists = await User.findOne({ $or: [{ username }, { email }] });
    if (alreadyExists)
        throw new ApiError(409, "Bhai ye username/email se linked account already exist karta hai!");

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    if (!coverImageLocalPath)
        throw new ApiError(400, "Cover Image to daalni padegi bhai!");

    // const avatar = "";
    // if (avatarLocalPath)
    //     avatar = await uploadOnCloudinary(avatarLocalPath);
    // const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    let avatar;
    if (avatarLocalPath) {
        try {
            avatar = await uploadOnCloudinary(avatarLocalPath);
            console.log("Avatar uploaded successfully");
        } catch (error) {
            console.log("Error uploading avatar", error);
            throw new ApiError(500, "Avatar upload nahi hua bhai!");
        }
    }

    let coverImage;
    try {
        coverImage = await uploadOnCloudinary(coverImageLocalPath);
        console.log("Cover image uploaded successfully");
    } catch (error) {
        console.log("Error uploading cover image", error);
        throw new ApiError(500, "Cover image upload nahi hua bhai!");
    }

    try {
        const user = await User.create({
            fullname,
            email: email.toLowerCase(),
            username: username.toLowerCase(),
            password,
            avatar: avatar?.url,
            coverImage: coverImage.url,
        });

        // Now the new user (account) should be created and stored in the database.
        // We confirm this by searching this same user in our database by using user._id
        const createdUser = await User.findById(user._id).select("-password -refreshToken");
        if (!createdUser)
            throw new ApiError(500, "Kuch to crazzyy galat ho gaya bhai while registering the user. Firse try karo!");

        return res
            .status(201)
            .json(new ApiResponse(201, createdUser, "Ho gaya bhai register. Badhai ho!"));

    } catch (error) {
        console.log("User creation failed!");

        if (avatar)
            await deleteFromCloudinary(avatar.public_id);
        if (coverImage)
            await deleteFromCloudinary(coverImage.public_id);

        throw new ApiError(500, "Kuch to crazzyy galat ho gaya bhai while registering the user. Uploaded images have been deleted. Firse try karo!");
    }
});

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user)
            throw new ApiError(404, `User not found! Cannot generate access and refresh tokens.`);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens!");
    }
};

const loginUser = asyncHandler(async (req, res) => {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail)
        throw new ApiError(400, "Username/email is required!");
    if (!password)
        throw new ApiError(400, "Password is required!");

    // Find user
    const user = await User.findOne({ $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] });
    if (!user)
        throw new ApiError(404, "User does not exist! Can't find an account with the given username or email.");

    // Validate password
    const valid = await user.isPasswordCorrect(password);
    if (!valid)
        throw new ApiError("Invalid user credentials! Try again");

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    if (!loggedInUser)
        throw new ApiError(500, "Something went wrong and login failed!");

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            { user: loggedInUser, accessToken, refreshToken },
            "User logged in successfully!"
        ));
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken)
        throw new ApiError(401, "Refresh token required");

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);
        if (!user)
            throw new ApiError(401, "Invalid refresh token");

        if (incomingRefreshToken !== user?.refreshToken)
            throw new ApiError(401, "Invalid refresh token, might have expired.");

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        };

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("accessToken", accessToken, options)
            .json(new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed successfully!"
            ));

    } catch (error) {
        throw new ApiError(500, "Something went wrong while refreshing the access token");
    }
});

export { registerUser, loginUser, refreshAccessToken, logoutUser };
import mongoose, { Schema } from "mongoose";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullname: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        coverImage: {
            type: String, // will be a cloudinary URL
            required: true,
        },
        avatar: {
            type: String, // will be a cloudinary URL
        },
        watchHistory: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Video",
                }
            ]
        },
        password: {
            type: String,
            required: [true, "Password is required, mere bhai!"],
        },
        refreshToken: {
            type: String
        }
    },
    { timestamps: true }
);

// Encrypt password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Check password
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    // short lived access token
    jwt.sign(
        {
            _id: this._id,
            // Rest is unnecessary info.
            email: this.email,
            username: this.username,
            fullname: this.fullname,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

userSchema.methods.generateRefreshToken = function () {
    jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};

export const User = mongoose.model("User", userSchema);
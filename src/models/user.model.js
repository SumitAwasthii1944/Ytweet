import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
        },
        fullName: {
            type: String,
            required: true,
            trim: true, 
            index: true
        },
        avatar: {
            type: String, // cloudinary url
            required: true,
        },
        coverImage: {
            type: String, // cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken: {
            type: String
        }

    },
    {
        timestamps: true
    }
)

userSchema.pre("save", async function () {// .pre() is a Mongoose middleware function that is executed before a document is saved to the database.
//  In this case, it is used to hash the user's password before saving it to the database. 
// The function checks if the password field has been modified (i.e., if the user has changed their password).
//  If it has not been modified, it simply calls next() to proceed with saving the document. If it has been modified,
//  it hashes the new password using bcrypt and then calls next() to save the document with the hashed password.
    if(!this.isModified("password")) return;//this.password refers to userSchema's password

    this.password = await bcrypt.hash(this.password, 10)
})

userSchema.methods.isPasswordCorrect = async function(password){//isPasswordCorrect is a custom method defined on the userSchema. 
// It takes a plain text password as an argument and compares it with the hashed password stored in the database using bcrypt's compare function. 
// It returns true if the passwords match and false otherwise. This method can be used during the login process to verify if the provided password is correct for the user.
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){//access token are short lived
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function(){//refresh token are generally long lived
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema)
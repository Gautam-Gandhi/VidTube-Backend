import mongoose from "mongoose";
import { DB_name } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_name}`);

        console.log(`\nMongoDB connected! DB Host: ${connectionInstance.connection.host}`);
    }
    catch (error) {
        console.log("MongoDB connect nahi hua bhai! Connection Error!", error);
        process.exit(1);
    }
};

export default connectDB;
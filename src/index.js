import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/index.js";
// import connection from "mongoose";

dotenv.config({
    path: "./.env"
});

const PORT = process.env.PORT || 3002;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server connected at port: ${PORT}`);
        });
    })
    .catch((err) => {
        console.log(`MongoDB connection error - ${err}`);
    });
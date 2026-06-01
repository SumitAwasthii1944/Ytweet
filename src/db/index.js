import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);// Exit the process with a failure code if the connection fails and 1 represents a general error. 
    // This is important to ensure that the application does not continue running without a database connection, which could lead to further errors down the line.
  }
};

export default connectDB;
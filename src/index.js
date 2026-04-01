//require('dotenv').config({path: './.env'});//dotenv aise bhi kaam krega aaram se but accha nhi lg rha
import dotenv from 'dotenv';
dotenv.config();
import {app} from "./app.js"
import connectDB from "./db/index.js";

connectDB()//it returns a promise, so we can use .then and .catch to handle the success and error cases respectively. 
// If the connection is successful, we can log a message or perform any other necessary actions.
//  If there is an error during the connection process, we catch it, log the error message, and
//  exit the process with a failure code to prevent the application from running without a database connection.
.then(() => {
          app.listen(process.env.PORT || 8000, () => {
                    console.log(`Server is running on port ${process.env.PORT || 8000}`);
          })
})
.catch((error) => {
  console.error("Error connecting to MongoDB:", error);
  process.exit(1);
});
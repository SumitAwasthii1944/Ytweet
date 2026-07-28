import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
//routes import
import userRouter from './routes/user.routes.js'
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"
import redis from './utils/redis.js';
const app = express()

// app.use(cors({
//     origin: (origin, callback) => {
//         // allow requests from your frontend only
//         if (!origin || origin === process.env.CORS_ORIGIN) {//allow requests with no origin (like mobile apps or curl requests) and from the specified frontend origin
//             callback(null, true)
//         } else {
//             callback(new Error("Not allowed by CORS"))
//         }
//     },
//     credentials: true//allow cookies to be sent in cross-origin requests
// }))
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//routes declaration



app.get('/redis', async (req, res) => {
  try {
    const reply = await redis.ping(); // "PONG"
    res.json({ redis: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

 //http://localhost:8000/api/v1/users/register

export { app }
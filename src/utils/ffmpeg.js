import ffmpeg from "fluent-ffmpeg"
import ffmpegStatic from "ffmpeg-static"
import {execSync} from "child_process"
//detect System FFmpeg
const getFFmpegPath = () => {
          try {
                    execSync("ffmpeg -version",{stdio:"ignore"})// 
                    console.log("using system FFmpeg")
                    return "ffmpeg"
          } catch (error) {
                    console.log("using ffmpeg-static fallback")
                    return ffmpegStatic
          }
}
// set path ONCE globally
ffmpeg.setFfmpegPath(getFFmpegPath())

export default ffmpeg
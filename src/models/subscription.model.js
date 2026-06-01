import mongoose,{Schema} from  "mongoose"

const subscriptionSchema=new Schema({//to find subscribers of channel a -->we have to count documents which contains channel:a,
// to find subscribed channels by a user select docs with subscriber:user
          subscriber:{
                    type:Schema.Types.ObjectId,//one who is subscribing
                    ref:"User"
          },
          channel:{
                    type:Schema.Types.ObjectId,//whom everyone is subscribed to
                    ref:"User"
          }

},{timestamps:true})




export const Subscription =mongoose.model("Subscription",subscriptionSchema)
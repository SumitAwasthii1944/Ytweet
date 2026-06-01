class ApiError extends Error {// This class extends the built-in Error class in JavaScript to create a custom error type called ApiError.
// It allows you to include additional information such as status code, message, errors, and stack trace when throwing an error in your application.
          constructor(
                    statusCode,
                    message="Something went wrong",
                    errors=[],
                    stack=""
          ){
                    super(message)
                    this.statusCode = statusCode
                    this.data=null
                    this.message = message
                    this.success = false
                    this.errors = errors

                    if(stack){
                              this.stack=stack
                    }else{
                              Error.captureStackTrace(this, this.constructor)
                    }
          }
}

export {ApiError}
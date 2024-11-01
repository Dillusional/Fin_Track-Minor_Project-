import {Router} from "express"
import {
    loginUser,
    logoutUser,
    registerUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    getUserInfo
} from "../controllers/user.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router()
router.route("/register")
.get((req,res)=>{
    res.render('register', {
        title: 'Expense Tracker - Register',
        emailExists: false, // Set to true if an error occurred
        emailError: false,  // Set to true if there's an email error
        passwordError: false, // Set to true if passwords don't match
        name: '',         // Set this to prefill the name field
        username: '',     // Set this to prefill the username field
        email: ''         // Set this to prefill the email field
    });
})
.post(registerUser)

router.route("/login")
.get((req, res)=>{
    res.render('login', { 
        title: 'Expense Tracker - Login',
        email: '' 
    });
})
.post(loginUser)

router.get('/info', verifyJWT, async (req, res) => {
    try {
        // Log the user object to see if it's populated
        console.log("User in Info Route:", req.user);
        
        if (!req.user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Pass the user object to the EJS view
        res.render('info', { user: req.user });
    } catch (error) {
        console.error("Error in Info Route:", error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

//Secured routes
//router.route("/logout").post(verifyJWT,logoutUser)
router.route("/logout").post(verifyJWT, logoutUser, (req, res) => {
    // Redirect to login page after logout
    res.redirect('/login'); 
});
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT,changeCurrentPassword)
router.route("/current-user").get(verifyJWT,getCurrentUser)
router.route("/update-account").patch(verifyJWT,updateAccountDetails)
router.route("/info").get(verifyJWT, getUserInfo);

export default router
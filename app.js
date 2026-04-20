const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const env = require("dotenv").config();
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require("express-session");
const morgan = require("morgan");
const passport = require("./config/passport");
const nocache = require("nocache");
const categoryRoutes = require('./routes/adminRouter')
const attachCartCount = require('./middlewares/cartCount')
const attachWishlistCount = require('./middlewares/wishlistCount')


db();

app.use(nocache());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  })
);

const User = require('./models/userSchema');

app.use(async (req, res, next) => {
  try {
    if (req.session.user?._id) {
      const fullUser = await User.findById(req.session.user._id).lean();
      res.locals.user = fullUser || null;
    } else {
      res.locals.user = null;
    }
  } catch (e) {
    res.locals.user = null;
  }
  next();
});




app.use(attachCartCount)
app.use(attachWishlistCount)


// Set EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(passport.initialize());
app.use(passport.session());

app.use("/", userRouter);
app.use("/user", userRouter);
app.use("/admin", adminRouter);



app.listen(3034, () => {
  console.log("http://localhost:3034");
});

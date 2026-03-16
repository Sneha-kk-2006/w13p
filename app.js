const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const env = require("dotenv").config();
const db = require("./config/db");
const userRouter = require("./router/userRouter");
const adminRouter = require("./router/adminRouter");
const session = require("express-session");
const morgan = require("morgan");
const passport = require("./config/passport");

db();

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
  }),
);

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

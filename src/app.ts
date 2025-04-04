import * as dotenv from "dotenv";
import express, { Application } from "express";
import router from "./routers/uploadRouters";
import path from "path";
dotenv.config();

const app: Application = express();

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "../src", "views"));

// Middleware to parse incoming JSON requests into JavaScript objects
app.use(express.json());
// Middleware to parse URL-encoded data (like form submissions)
app.use(express.urlencoded({ extended: true }));
//Initialize the router directory
app.use("/", router);
// Directory for static files
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
app.listen(PORT, () => console.log(`App listening on port ${PORT}`));

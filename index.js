import express from "express";
require('dotenv').config();

const app = express();
app.listen(5000);
console.log("Server yes")
app.get("/", (req,res)=> {
    res.send("Ankit Proj");
})
app.get("/twitter", (req, res)=> {
    res.send("ankitdotcom");
})

app.listen(process.env.PORT, () => {
    console.log("Test example Port");
})
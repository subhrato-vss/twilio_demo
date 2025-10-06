require('dotenv').config();

// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
//
// const client = require("twilio")(accountSid, authToken);
//
// async function createCall() {
//     const call = await client.calls.create({
//         from: process.env.TWILIO_PHONE_NUMBER,
//         method: "GET",
//         statusCallback: "https://www.myapp.com/events",
//         statusCallbackEvent: ["initiated", "answered"], // Get call status events during a call
//         statusCallbackMethod: "POST",
//         to: "+918198850602",
//         url: process.env.URL,
//         // record: true, // Record an outbound cal
//     });
//
//     console.log(call);
//     // console.log(call.sid);
// }
//
// createCall();

// --------------------------------------
// --------------------------------------

const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
require("dotenv").config();

const app = express();
app.use(cors());

// Twilio credentials from your Console
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioApiKey = process.env.TWILIO_API_KEY;
const twilioApiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID; // TwiML App SID

// Endpoint to generate access token
app.get("/get-twilio-token", (req, res) => {
    const identity = req.query.emp || "employee1"; // employee identity

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
        twilioAccountSid,
        twilioApiKey,
        twilioApiSecret,
        { identity }
    );

    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    res.json({
        identity,
        token: token.toJwt(),
    });
});

// TwiML App route for making outbound calls
app.post("/voice", (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const toNumber = req.body.To;

    if (toNumber) {
        twiml.dial(toNumber); // call customer phone number
    } else {
        twiml.say("No number provided");
    }

    res.type("text/xml");
    res.send(twiml.toString());
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
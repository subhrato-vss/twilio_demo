const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const logger = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(logger('dev'));
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;

const client = twilio(accountSid, authToken);

// Generate access token for frontend
app.post('/token', async (req, res) => {
    try {
        const {identity} = req.body; // User identifier from your auth system

        if (!identity) {
            return res.status(400).json({error: 'Identity is required'});
        }

        // Create access token
        const AccessToken = twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;

        const accessToken = new AccessToken(
            accountSid,
            apiKey,
            apiSecret,
            {identity}
        );

        // Grant voice capabilities
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: twimlAppSid,
            incomingAllow: true // Allow incoming calls if needed
        });

        accessToken.addGrant(voiceGrant);

        res.json({
            identity,
            token: accessToken.toJwt()
        });
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({error: 'Failed to generate token'});
    }
});

// TwiML webhook - handles outbound calls
app.post('/voice', (req, res) => {
    console.log('🔥 /voice called by Twilio!');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);

    const twiml = new twilio.twiml.VoiceResponse();

    try {
        const {To, From} = req.body;

        if (To && To !== 'client') {
            // Outbound call to customer
            const dial = twiml.dial({
                callerId: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
                action: '/dial-status', // Optional: handle dial completion
                timeout: 30, // Ring for 30 seconds
                record: 'do-not-record' // Don't record calls in development
            });

            // Remove 'client:' prefix if present
            const customerNumber = To.replace('client:', '');
            dial.number(customerNumber);

        } else {
            // Handle incoming calls or other scenarios
            twiml.say('Welcome to our calling system.');
        }

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('TwiML generation error:', error);
        twiml.say('An error occurred. Please try again.');
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// Handle dial completion status
app.post('/dial-status', (req, res) => {
    const {DialCallStatus, DialCallDuration, CallSid} = req.body;

    console.log(`📞 Dial completed for ${CallSid}:`);
    console.log(`Status: ${DialCallStatus}, Duration: ${DialCallDuration}s`);

    const twiml = new twilio.twiml.VoiceResponse();

    switch (DialCallStatus) {
        case 'completed':
            // Call was answered and completed
            twiml.say('Call completed. Thank you.');
            break;
        case 'busy':
            twiml.say('The customer line is busy. Please try again later.');
            break;
        case 'no-answer':
            twiml.say('The customer did not answer. Please try again later.');
            break;
        case 'failed':
            twiml.say('The call failed. Please check the number and try again.');
            break;
        case 'canceled':
            twiml.say('The call was canceled.');
            break;
        default:
            twiml.say('Call ended.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// Call status webhook (optional but recommended)
app.post('/call-status', (req, res) => {
    const {CallSid, CallStatus, To, From, Direction} = req.body;

    console.log(`📞 Call ${CallSid} status: ${CallStatus}`);
    console.log(`From: ${From}, To: ${To}, Direction: ${Direction}`);

    // Log different call statuses
    switch (CallStatus) {
        case 'ringing':
            console.log('📱 Customer phone is ringing...');
            break;
        case 'in-progress':
            console.log('✅ Customer answered! Call is in progress');
            break;
        case 'completed':
            console.log('✅ Call completed successfully');
            break;
        case 'busy':
            console.log('📞 Customer line is busy');
            break;
        case 'no-answer':
            console.log('❌ Customer did not answer');
            break;
        case 'failed':
            console.log('❌ Call failed');
            break;
        case 'canceled':
            console.log('❌ Call was canceled');
            break;
    }

    // You could emit this status to frontend via WebSocket or store in database
    // Example: io.emit('call-status', { CallSid, CallStatus, To });

    res.sendStatus(200);
});

// Verify a phone number (for trial account testing)
app.post('/verify-number', async (req, res) => {
    try {
        const {phoneNumber} = req.body;

        const validation = await client.validationRequests.create({
            phoneNumber: phoneNumber,
            friendlyName: `Customer ${phoneNumber}`
        });

        res.json({
            success: true,
            message: 'Verification call sent',
            validationRequestSid: validation.sid
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({error: 'Failed to send verification'});
    }
});

// Get call history (optional)
app.get('/calls', async (req, res) => {
    try {
        const calls = await client.calls.list({
            limit: 50,
            status: ['completed', 'in-progress', 'ringing']
        });

        res.json(calls.map(call => ({
            sid: call.sid,
            to: call.to,
            from: call.from,
            status: call.status,
            duration: call.duration,
            dateCreated: call.dateCreated
        })));
    } catch (error) {
        console.error('Error fetching calls:', error);
        res.status(500).json({error: 'Failed to fetch call history'});
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;

// const express = require('express');
// const twilio = require('twilio');
// const cors = require('cors');
// require('dotenv').config();
//
// const app = express();
//
// // Middleware
// app.use(express.urlencoded({extended: false}));
// app.use(express.json());
// app.use(cors({
//     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//     credentials: true
// }));
//
// // Twilio configuration
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
// const apiKey = process.env.TWILIO_API_KEY;
// const apiSecret = process.env.TWILIO_API_SECRET;
//
// const client = twilio(accountSid, authToken);
//
// // Generate access token for frontend
// app.post('/token', async (req, res) => {
//     try {
//         const {identity} = req.body; // User identifier from your auth system
//
//         if (!identity) {
//             return res.status(400).json({error: 'Identity is required'});
//         }
//
//         // Create access token
//         const AccessToken = twilio.jwt.AccessToken;
//         const VoiceGrant = AccessToken.VoiceGrant;
//
//         const accessToken = new AccessToken(
//             accountSid,
//             apiKey,
//             apiSecret,
//             {identity}
//         );
//
//         // Grant voice capabilities
//         const voiceGrant = new VoiceGrant({
//             outgoingApplicationSid: twimlAppSid,
//             incomingAllow: true // Allow incoming calls if needed
//         });
//
//         accessToken.addGrant(voiceGrant);
//
//         res.json({
//             identity,
//             token: accessToken.toJwt()
//         });
//     } catch (error) {
//         console.error('Token generation error:', error);
//         res.json({error: 'Failed to generate token'});
//         // res.status(500).json({error: 'Failed to generate token'});
//     }
// });
//
// // TwiML webhook - handles outbound calls
// app.post('/voice', (req, res) => {
//     const twiml = new twilio.twiml.VoiceResponse();
//
//     try {
//         const {To, From} = req.body;
//
//         if (To && To !== 'client') {
//             // Outbound call to customer
//             const dial = twiml.dial({
//                 callerId: process.env.TWILIO_PHONE_NUMBER // Your Twilio number
//             });
//
//             // Remove 'client:' prefix if present
//             const customerNumber = To.replace('client:', '');
//             dial.number(customerNumber);
//         } else {
//             // Handle incoming calls or other scenarios
//             twiml.say('Welcome to our calling system.');
//         }
//
//         res.type('text/xml');
//         res.send(twiml.toString());
//     } catch (error) {
//         console.error('TwiML generation error:', error);
//         twiml.say('An error occurred. Please try again.');
//         res.type('text/xml');
//         res.send(twiml.toString());
//     }
// });
//
// // Call status webhook (optional but recommended)
// app.post('/call-status', (req, res) => {
//     const {CallSid, CallStatus, To, From} = req.body;
//
//     console.log(`Call ${CallSid} status: ${CallStatus}`);
//     console.log(`From: ${From}, To: ${To}`);
//
//     // Log to database or perform other actions based on call status
//     // CallStatus values: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
//
//     res.sendStatus(200);
// });
//
// // Get call history (optional)
// app.get('/calls', async (req, res) => {
//     try {
//         const calls = await client.calls.list({
//             limit: 50,
//             status: ['completed', 'in-progress', 'ringing']
//         });
//
//         res.json(calls.map(call => ({
//             sid: call.sid,
//             to: call.to,
//             from: call.from,
//             status: call.status,
//             duration: call.duration,
//             dateCreated: call.dateCreated
//         })));
//     } catch (error) {
//         console.error('Error fetching calls:', error);
//         res.status(500).json({error: 'Failed to fetch call history'});
//     }
// });
//
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });
//
// module.exports = app;
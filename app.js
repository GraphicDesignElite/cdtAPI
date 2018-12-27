// Include Requirements
const express = require('express');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const path = require('path');
const helmet = require('helmet');
const dotenv = require('dotenv');
dotenv.load();
const { check, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const request = require('request');
const firebaseConn = require('./functions/firebase');
const port = process.env.PORT || 4000;



// Set up Firebase
var admin = require("firebase-admin");
var serviceAccount = require("./capitaldistricttherapy-77e4b-firebase-adminsdk-0gtxb-561b3630c0.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://capitaldistricttherapy-77e4b.firebaseio.com"
});
const db = admin.firestore();
const settings = { timestampsInSnapshots: true };
db.settings(settings);

// Set up Server
const app = express();
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.use('/public', express.static(path.join(__dirname, 'public')));

//Middleware
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/', (req, res, next) => {
    res.render('contact');
});

app.post('/contact', [
    // username must be an email
    check('email').isEmail().withMessage('The email address you provided is invalid.'),
    check('name').trim().isLength({ min: 1 }).withMessage('A name must be provided.')
        .isAlpha().withMessage('Only text is allowed in the name field'),
    check('phone').isLength({ min: 10 }).withMessage('A valid phone number with an area code is required.'),
    check('message').isLength({ max: 255 }).withMessage('Only 255 characters are allowed in your message.'),

], (req, res, next) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errorCodes: errors.array()
        });
    }

    // Check Captcha
    var secret = process.env.RECAPTCHA_KEY;
    var response = req.body.token;
    var recaptchaURL = 'https://www.google.com/recaptcha/api/siteverify?secret=' + secret + '&response=' + response;

    request({
        url: recaptchaURL,
        method: "POST",
    },
        function (error, response, body) {
            var result = JSON.parse(body);
            if (result.success === true) { //passes Recaptcha


                const name = req.body.name.trim();
                const email = req.body.email.trim();
                const phone = req.body.phone.trim();
                const message = req.body.message.trim();
                const data = {
                    name: name,
                    email: email,
                    phone: phone,
                    message: message
                };
                const adminEmail = `
                    <h3>Contact Details</h3>
                    <p>Contact Message Recieved</p>
                    <ul>
                        <li><strong>Visitor Name:</strong> ${data.name}</li>
                        <li><strong>Email Address:</strong> ${data.email}</li>
                        <li><strong>Phone Number:</strong> ${data.phone}</li>
                    </ul>
                    <h4>Message</h4>
                    <p>${data.message}</p>
                `
                const adminPTEmail = `
                    Contact Message Recieved: 
                    Visitor Name: ${data.name}. Email Address: ${data.email}. Phone Number: ${data.phone}. 
                    Important: Please let admin know you recieved a text version of this email.
                `

                // using SendGrid's v3 Node.js Library
                // https://github.com/sendgrid/sendgrid-nodejs
                // message to admin
                const sgMail = require('@sendgrid/mail');
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                const msg = {
                    to: process.env.SEND_TO_EMAIL,
                    from: process.env.ADMIN_EMAIL,
                    replyTo: process.env.ADMIN_EMAIL,
                    subject: 'Capital District Therapy Message',
                    text: adminPTEmail,
                    html: adminEmail,
                };
                sgMail.send(msg)
                    .then(() => {
                        firebaseConn.storeEmailContact(db, data, true);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(body));
                    })
                    .catch(error => {
                        // Attempt to at least store to db
                        firebaseConn.storeEmailContact(db, data, false);
                        var errorObj = {
                            success: false,
                            errorCodes: error
                        }
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(errorObj));
                    });
            } else {
                console.log('Captcha Fail');
                var properties = Object.keys(result);
                var errorCodes = result[properties[1]];
                // Return an object with errors
                var errorObj = {
                    success: false,
                    errorCodes: errorCodes
                }
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(errorObj));
            }
        });
});

app.use("*", function (req, res) {
    res.status(404).send("404");
});

app.use(function (err, req, res, next) {
    console.error(err.stack)
    res.status(500).send(err.stack);
});

app.listen(port, () => console.log('Server Running'));



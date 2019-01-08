// Include Requirements
const express = require('express');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const path = require('path');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { check, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const request = require('request');
const helpers = require('./functions/helpers');
const port = process.env.PORT || 4000;
dotenv.load();


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



app.get('/', (req, res) => {
    res.render('contact');
});

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.post('/contact', [
    // username must be an email
    check('email').isEmail().withMessage('The email address you provided is invalid.'),
    check('firstname').trim().isLength({ min: 1 }).withMessage('A first name must be provided.')
        .isAlpha().withMessage('Only text is allowed in the first name field'),
    check('lastname').trim().isLength({ min: 1 }).withMessage('A last name must be provided.')
        .isAlpha().withMessage('Only text is allowed in the last name field'),
    check('phone').isLength({ min: 10 }).withMessage('A valid phone number with an area code is required.'),
    check('message').isLength({ max: 255 }).withMessage('Only 255 characters are allowed in your message.'),
    check('contactmethod').trim().isLength({ min: 1 }).withMessage('You must select a contact method.'),
    check('reason').trim().isLength({ min: 1 }).withMessage('Please select a reason for contacting us.'),

], (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {

        return res.status(401).json({
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
    }, function (error, response, body) {

        var result = JSON.parse(body);
        if (result.success === true) { //passes Recaptcha
            console.log('Captcha Pass'); //

            const firstname = req.body.firstname.trim();
            const lastname = req.body.lastname.trim();
            const email = req.body.email.trim();
            const phone = req.body.phone.trim();
            const contactmethod = req.body.contactmethod.trim();
            const reason = req.body.reason.trim();
            const message = req.body.message.trim();
            const data = {
                firstname: firstname,
                lastname: lastname,
                email: email,
                phone: phone,
                message: message,
                contactmethod:contactmethod,
                reason:reason
            };

            const adminEmail = `
            <h3>Contact Details</h3>
            <p>Contact Message Recieved</p>
            <ul>
                <li><strong>Visitor Name:</strong> ${data.firstname} ${data.lastname}</li>
                <li><strong>Email Address:</strong> ${data.email}</li>
                <li><strong>Phone Number:</strong> ${data.phone}</li>
                <li><strong>Preferred Contact Method:</strong> ${data.contactmethod}</li>
            </ul>
            <h4>Reason For Contact</h4>
            <li>${data.reason}</li>
            <h4>Message</h4>
            <p>${data.message}</p>
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
                subject: 'Message to Capital District Therapy',
                text: 'Plain Text Error',
                html: adminEmail,
            };
            sgMail.send(msg)
                .then(() => {
                    helpers.submitToFirebase(db, data, true);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                })
                .catch(error => {
                    //Log friendly error
                    console.error(error.toString());
                    helpers.submitToFirebase(db, data, false);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    var errorObj = {
                        success: false,
                        errorCodes: error
                    }
                    res.end(JSON.stringify(errorObj));
                });
        } else {
            console.log('Captcha Fail');
            var properties = Object.keys(result);
            var errorCodes = result[properties[1]];
            var errorObj = {
                success: false,
                errorCodes: errorCodes
            }
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(errorObj));
        }
    });

});

app.post('/consultation', [
    // username must be an email
    check('email').isEmail().withMessage('The email address you provided is invalid.'),
    check('firstname').trim().isLength({ min: 1 }).withMessage('A first name must be provided.')
        .isAlpha().withMessage('Only text is allowed in the first name field'),
    check('lastname').trim().isLength({ min: 1 }).withMessage('A last name must be provided.')
        .isAlpha().withMessage('Only text is allowed in the last name field'),
    check('phone').isLength({ min: 10 }).withMessage('A valid phone number with an area code is required.'),
    check('message').isLength({ max: 255 }).withMessage('Only 255 characters are allowed in your message.'),
    check('servicetype').trim().isLength({ min: 1 }).withMessage('Please choose a therapy method.'),
    check('service').trim().isLength({ min: 1 }).withMessage('Please select a type of therapy.'),
    check('day').trim().isLength({ min: 1 }).withMessage('Please choose a day for your consultation.'),
    check('start').trim().isLength({ min: 1 }).withMessage('Please select a start time.'),
    check('end').trim().isLength({ min: 1 }).withMessage('Please select an end time.'),

], (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {

        return res.status(401).json({
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
    }, function (error, response, body) {

        var result = JSON.parse(body);
        if (result.success === true) { //passes Recaptcha

            const firstname = req.body.firstname.trim();
            const lastname = req.body.lastname.trim();
            const email = req.body.email.trim();
            const phone = req.body.phone.trim();
            const service = req.body.service.trim();
            const servicetype = req.body.servicetype.trim();
            const day = req.body.day.trim();
            const start = req.body.start.trim();
            const end = req.body.end.trim();
            const message = req.body.message.trim();
            const data = {
                firstname: firstname,
                lastname: lastname,
                email: email,
                phone: phone,
                message: message,
                service: service,
                servicetype: servicetype,
                day:day,
                start:start,
                end:end
            };

            const adminEmail = `
            <h3>Consultation Details</h3>
            <p>Contact Message Recieved</p>
            <ul>
                <li><strong>Visitor Name:</strong> ${data.firstname} ${data.lastname}</li>
                <li><strong>Email Address:</strong> ${data.email}</li>
                <li><strong>Phone Number:</strong> ${data.phone}</li>
                <li><strong>Therapy Service Client is Interested In:</strong> ${data.service} - ${data.servicetype}</li>
            </ul>
            <h4>Availability Chosen</h4>
            <li>${data.day} : ${data.start} to ${data.end}</li>
            <h4>Optional Message</h4>
            <p>${data.message}</p>
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
                subject: 'Consultation Requested - Capital District Therapy',
                text: 'Plain Text Error',
                html: adminEmail,
            };
            sgMail.send(msg)
                .then(() => {
                    helpers.consultationToFirebase(db, data, true);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                })
                .catch(error => {
                    //Log friendly error
                    console.error(error.toString());
                    helpers.consultationToFirebase(db, data, false);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    var errorObj = {
                        success: false,
                        errorCodes: error
                    }
                    res.end(JSON.stringify(errorObj));
                });
        } else {
            console.log('Captcha Fail');
            var properties = Object.keys(result);
            var errorCodes = result[properties[1]];
            var errorObj = {
                success: false,
                errorCodes: errorCodes
            }
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(errorObj));
        }
    });

});


app.use("*", function (req, res) {
    res.status(404).send("404");
})

app.listen(port, () => console.log('Server Running'));
module.exports = {
    submitToFirebase: function (db, data, emailSuccess) {
        var docRef = db.collection('contact');

        var setContact = docRef.add({
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            phone: data.phone,
            message: data.message,
            reason: data.reason,
            contactmethod: data.contactmethod,
            emailSent: emailSuccess
        });
    },
    consultationToFirebase: function (db, data, emailSuccess) {
        var docRef = db.collection('consultation');

        var setContact = docRef.add({
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            phone: data.phone,
            message: data.message,
            service: data.service,
            servicetype: data.servicetype,
            day: data.day,
            start: data.start,
            end: data.end,
            emailSent: emailSuccess
        });
    }
}

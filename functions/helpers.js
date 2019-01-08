module.exports = {
    submitToFirebase: function (db, data, emailSuccess) {
        var docRef = db.collection('contact').doc(data.email);

        var setContact = docRef.set({
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            phone: data.phone,
            message: data.message,
            reason: data.reason,
            contactmethod: data.contactmethod,
            emailSent: emailSuccess
        });
    }
}

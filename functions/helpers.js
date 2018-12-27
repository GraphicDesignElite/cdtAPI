module.exports = {
    submitToFirebase: function (db, data, emailSuccess) {
        var docRef = db.collection('contact').doc(data.email);

        var setContact = docRef.set({
            name: data.name,
            email: data.email,
            phone: data.phone,
            message: data.message,
            emailSent: emailSuccess
        });
    }
}

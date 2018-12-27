
module.exports = {
    storeEmailContact: function (db, data, emailSuccess) {
        var docRef = db.collection('contact');

        var setContact = docRef.add({
            name: data.name,
            email: data.email,
            phone: data.phone,
            message: data.message,
            emailSent: emailSuccess
        }).then(ref => {
            console.log('Added document with ID: ', ref.id);
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-submission-form]').forEach(form => {
        form.addEventListener('submit', async event => {
            event.preventDefault();

            const status = document.getElementById('formStatus');

            try {
                const submission = {};
                new FormData(form).forEach((value, name) => {
                    submission[name] = value;
                });
                submission.formType = form.dataset.formType;
                submission.createdAt = firebase.firestore.FieldValue.serverTimestamp();

                await db.collection('submissions').add(submission);
                status.style.display = 'block';
                status.className = 'auth-status success';
                status.textContent = form.dataset.successMessage;
                form.reset();

                window.setTimeout(() => {
                    window.location.href = '../get-involved.html';
                }, 2000);
            } catch (error) {
                console.error('Error writing document:', error);
                status.style.display = 'block';
                status.className = 'auth-status error';
                status.textContent = 'Error submitting form. Please try again.';
            }
        });
    });
});

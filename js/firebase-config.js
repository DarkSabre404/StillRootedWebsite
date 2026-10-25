// js/firebase-config.js
// Still Rooted Centralized Firebase Initialization

const firebaseConfig = {
    apiKey: "AIzaSyC0F49hnhWfz4M5NPUAMX-3ebwFKAyBKCo",
    authDomain: "still-rooted.firebaseapp.com",
    projectId: "still-rooted",
    storageBucket: "still-rooted.firebasestorage.app",
    messagingSenderId: "436176998742",
    appId: "1:436176998742:web:e1ef960d182a922cd486f7",
    measurementId: "G-3V6322ZSLX"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Global service shortcuts
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage ? firebase.storage() : null;
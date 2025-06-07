// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAfMW5eXOy3llLfnkZzZPaXpzHs_hHh4zw",
    authDomain: "ask-a-question-today.firebaseapp.com",
    projectId: "ask-a-question-today",
    storageBucket: "ask-a-question-today.firebasestorage.app",
    messagingSenderId: "186886414631",
    appId: "1:186886414631:web:69310ba976035fce160902",
    measurementId: "G-TFZ60S283E"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Configure Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Export for use in other files
window.auth = auth;
window.db = db;
window.googleProvider = googleProvider;

console.log('Firebase initialized successfully');
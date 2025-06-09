// Global Variables
let currentUser = null;
let currentQuestionId = null;
let isSignupMode = false;

// DOM Elements
const authButtons = document.getElementById('auth-buttons');
const userMenu = document.getElementById('user-menu');
const authModal = document.getElementById('auth-modal');
const overlay = document.getElementById('overlay');
const questionsList = document.getElementById('questions-list');

// Page Elements
const homePage = document.getElementById('home-page');
const askQuestionPage = document.getElementById('ask-question-page');
const questionDetailPage = document.getElementById('question-detail-page');
const profilePage = document.getElementById('profile-page');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initializing...');
    
    // Check authentication state
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            showUserMenu();
            createUserDocument(user);
        } else {
            currentUser = null;
            showAuthButtons();
        }
    });
    
    // Load initial questions
    loadQuestions();
    
    // Setup event listeners
    setupEventListeners();
});

// Authentication Functions
function showLoginModal() {
    isSignupMode = false;
    document.getElementById('auth-modal-title').textContent = 'Login';
    document.getElementById('auth-submit-btn').textContent = 'Login';
    document.getElementById('auth-switch-text').textContent = "Don't have an account?";
    document.getElementById('auth-switch-link').textContent = 'Sign up';
    showModal();
}

function showSignupModal() {
    isSignupMode = true;
    document.getElementById('auth-modal-title').textContent = 'Sign Up';
    document.getElementById('auth-submit-btn').textContent = 'Sign Up';
    document.getElementById('auth-switch-text').textContent = 'Already have an account?';
    document.getElementById('auth-switch-link').textContent = 'Login';
    showModal();
}

function toggleAuthMode() {
    if (isSignupMode) {
        showLoginModal();
    } else {
        showSignupModal();
    }
}

function showModal() {
    authModal.style.display = 'flex';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    authModal.style.display = 'none';
    overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('email-auth-form').reset();
}

function showUserMenu() {
    authButtons.style.display = 'none';
    userMenu.style.display = 'block';
    
    document.getElementById('user-name').textContent = currentUser.displayName || currentUser.email.split('@')[0];
    document.getElementById('user-avatar').src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || currentUser.email}&background=random`;
    
    loadUserReputation();
}

function showAuthButtons() {
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
}

async function signInWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        console.log('Google sign-in successful:', result.user);
        closeAuthModal();
    } catch (error) {
        console.error('Google sign-in error:', error);
        alert('Google sign-in failed: ' + error.message);
    }
}

async function signInWithEmail(email, password) {
    try {
        if (isSignupMode) {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            console.log('Sign-up successful:', result.user);
        } else {
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log('Sign-in successful:', result.user);
        }
        closeAuthModal();
    } catch (error) {
        console.error('Email auth error:', error);
        alert('Authentication failed: ' + error.message);
    }
}

async function logout() {
    try {
        await auth.signOut();
        showHome();
        console.log('User signed out');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// User Management
async function createUserDocument(user) {
    try {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            const userData = {
                displayName: user.displayName || user.email.split('@')[0],
                firstName: '',
                lastName: '',
                email: user.email || '',
                photoURL: user.photoURL || '',
                reputation: 0,
                joinDate: firebase.firestore.FieldValue.serverTimestamp(),
                questionsAsked: 0,
                answersGiven: 0
            };
            
            if (user.providerData.some(p => p.providerId === 'google.com') && user.displayName) {
                const nameParts = user.displayName.split(' ');
                userData.firstName = nameParts[0] || '';
                userData.lastName = nameParts.slice(1).join(' ') || '';
            }
            
            await userRef.set(userData);
            console.log('User document created successfully');
        } else {
            console.log('User document already exists');
        }
    } catch (error) {
        console.error('Error creating user document:', error);
    }
}

async function loadUserReputation() {
    if (!currentUser) return;
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            document.getElementById('user-rep').textContent = userDoc.data().reputation || 0;
        }
    } catch (error) {
        console.error('Error loading user reputation:', error);
        document.getElementById('user-rep').textContent = '0';
    }
}

// Navigation Functions
function showHome() {
    homePage.style.display = 'block';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'none';
    profilePage.style.display = 'none';
    loadQuestions();
}

function showAskQuestion() {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    homePage.style.display = 'none';
    askQuestionPage.style.display = 'block';
    questionDetailPage.style.display = 'none';
    profilePage.style.display = 'none';
}

function showQuestionDetail(questionId) {
    currentQuestionId = questionId;
    homePage.style.display = 'none';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'block';
    profilePage.style.display = 'none';
    loadQuestionDetail(questionId);
}

// Profile Page Functions
function showProfilePage() {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    homePage.style.display = 'none';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'none';
    profilePage.style.display = 'block';

    toggleUserMenu(true); // Close dropdown
    loadProfileData();
}

async function loadProfileData() {
    if (!currentUser) return;
    document.getElementById('profile-email').value = currentUser.email || '';
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('profile-first-name').value = userData.firstName || '';
            document.getElementById('profile-last-name').value = userData.lastName || '';
            const photoURL = userData.photoURL || '';
            document.getElementById('profile-photo-url').value = photoURL;
            document.getElementById('profile-avatar-preview').src = photoURL || `https://ui-avatars.com/api/?name=${userData.displayName}&background=random&size=80`;
        }
    } catch (error) {
        console.error('Error loading user profile data:', error);
        alert('Could not load your profile data.');
    }
}

async function updateUserProfile(event) {
    event.preventDefault();
    if (!currentUser) return;

    const firstName = document.getElementById('profile-first-name').value.trim();
    const lastName = document.getElementById('profile-last-name').value.trim();
    const photoURL = document.getElementById('profile-photo-url').value.trim();
    const newDisplayName = `${firstName} ${lastName}`.trim();

    if (!newDisplayName) {
        alert('Please provide at least a first or last name.');
        return;
    }

    try {
        await currentUser.updateProfile({ displayName: newDisplayName, photoURL: photoURL });
        await db.collection('users').doc(currentUser.uid).update({
            firstName: firstName,
            lastName: lastName,
            displayName: newDisplayName,
            photoURL: photoURL
        });

        currentUser = auth.currentUser; // Re-fetch to get updated values
        showUserMenu();
        
        alert('Profile updated successfully!');
        showHome();
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
    }
}

// Questions Functions
async function loadQuestions(filter = 'newest') {
    try {
        questionsList.innerHTML = '<div class="loading">Loading questions...</div>';
        let query = db.collection('questions');
        switch (filter) {
            case 'votes': query = query.orderBy('voteCount', 'desc'); break;
            case 'answers': query = query.orderBy('answerCount', 'desc'); break;
            default: query = query.orderBy('timestamp', 'desc');
        }
        const snapshot = await query.limit(20).get();
        if (snapshot.empty) {
            questionsList.innerHTML = '<div class="loading">No questions yet. Be the first to ask!</div>';
            return;
        }
        const questionsHTML = snapshot.docs.map(doc => createQuestionCard(doc.id, doc.data())).join('');
        questionsList.innerHTML = questionsHTML;
    } catch (error) {
        console.error('Error loading questions:', error);
        questionsList.innerHTML = '<div class="loading">Error loading questions. Please try again.</div>';
    }
}

function createQuestionCard(id, question) {
    const timeAgo = getTimeAgo(question.timestamp?.toDate());
    const excerpt = question.body.length > 150 ? question.body.substring(0, 150) + '...' : question.body;
    const authorPhoto = question.authorPhoto || `https://ui-avatars.com/api/?name=${question.authorName}&background=random`;
    
    return `
        <div class="question-card" onclick="showQuestionDetail('${id}')">
            <div class="question-stats">
                <div class="stat"><span class="stat-number">${question.voteCount || 0}</span><span>votes</span></div>
                <div class="stat"><span class="stat-number">${question.answerCount || 0}</span><span>answers</span></div>
            </div>
            <h3 class="question-title">${escapeHtml(question.title)}</h3>
            <p class="question-excerpt">${escapeHtml(excerpt)}</p>
            <div class="question-meta">
                <div class="question-author">
                    <img src="${authorPhoto}" alt="Author" class="author-avatar">
                    <span>${escapeHtml(question.authorName)}</span>
                </div>
                <span class="question-time">${timeAgo}</span>
            </div>
        </div>
    `;
}

async function submitQuestion(event) {
    event.preventDefault();
    if (!currentUser) { showLoginModal(); return; }
    const title = document.getElementById('question-title').value.trim();
    const body = document.getElementById('question-body').value.trim();
    if (!title || !body) { alert('Please fill in both title and body'); return; }
    
    try {
        const questionData = {
            title: title,
            body: body,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email,
            authorPhoto: currentUser.photoURL || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            voteCount: 0,
            answerCount: 0,
            votes: {}
        };
        const docRef = await db.collection('questions').add(questionData);
        
        // Update user stats and reputation (+1 for asking a question)
        await db.collection('users').doc(currentUser.uid).update({
            questionsAsked: firebase.firestore.FieldValue.increment(1),
            reputation: firebase.firestore.FieldValue.increment(1)
        });
        
        document.getElementById('ask-question-form').reset();
        showQuestionDetail(docRef.id);
        
        // Update displayed reputation
        loadUserReputation();
    } catch (error) {
        console.error('Error posting question:', error);
        alert('Error posting question. Please try again.');
    }
}

async function loadQuestionDetail(questionId) {
    try {
        const questionDoc = await db.collection('questions').doc(questionId).get();
        if (!questionDoc.exists) {
            document.getElementById('question-detail').innerHTML = '<p>Question not found.</p>';
            return;
        }
        const question = questionDoc.data();
        const timeAgo = getTimeAgo(question.timestamp?.toDate());
        const isQuestionAuthor = currentUser && question.authorId === currentUser.uid;
        const questionHTML = `
            <div class="question-header">
                <h1>${escapeHtml(question.title)}</h1>
                <div class="question-meta"><span>Asked ${timeAgo} by ${escapeHtml(question.authorName)}</span></div>
            </div>
            <div class="vote-body-wrapper">
                <div class="question-votes">
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', 1)" ${!currentUser || isQuestionAuthor ? 'disabled' : ''}>▲</button>
                    <span class="vote-count">${question.voteCount || 0}</span>
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', -1)" ${!currentUser || isQuestionAuthor ? 'disabled' : ''}>▼</button>
                </div>
                <div class="content-body">
                    <div class="question-body">${escapeHtml(question.body).replace(/\n/g, '<br>')}</div>
                </div>
            </div>`;
        document.getElementById('question-detail').innerHTML = questionHTML;
        loadAnswers(questionId);
        document.getElementById('answer-form-section').style.display = currentUser ? 'block' : 'none';
    } catch (error) {
        console.error('Error loading question detail:', error);
        document.getElementById('question-detail').innerHTML = '<p>Error loading question.</p>';
    }
}

async function loadAnswers(questionId) {
    try {
        const answersSnapshot = await db.collection('answers').where('questionId', '==', questionId).get();
        const answerCount = answersSnapshot.size;
        document.getElementById('answers-count').textContent = `${answerCount} Answer${answerCount !== 1 ? 's' : ''}`;
        const answersListElement = document.getElementById('answers-list');
        if (answerCount === 0) {
            answersListElement.innerHTML = '<p class="text-muted">No answers yet. Be the first to answer!</p>';
            return;
        }
        const answersData = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        answersData.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        const answersHTML = answersData.map(answer => {
            const timeAgo = getTimeAgo(answer.timestamp?.toDate());
            const authorPhoto = answer.authorPhoto || `https://ui-avatars.com/api/?name=${answer.authorName}&background=random`;
            const isAuthor = currentUser && answer.authorId === currentUser.uid;
            
            const deleteButton = isAuthor ? 
                `<button class="delete-btn" onclick="deleteAnswer('${answer.id}')" title="Delete answer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>` : '';
            
            return `
                <div class="answer-card">
                    <div class="vote-body-wrapper">
                        <div class="question-votes">
                            <button class="vote-btn" onclick="voteAnswer('${answer.id}', 1)" ${!currentUser || isAuthor ? 'disabled' : ''}>▲</button>
                            <span class="vote-count">${answer.voteCount || 0}</span>
                            <button class="vote-btn" onclick="voteAnswer('${answer.id}', -1)" ${!currentUser || isAuthor ? 'disabled' : ''}>▼</button>
                        </div>
                        <div class="content-body">
                            <div class="answer-body">${escapeHtml(answer.body).replace(/\n/g, '<br>')}</div>
                            <div class="question-meta mt-20">
                                <div class="question-author">
                                    <img src="${authorPhoto}" alt="Author" class="author-avatar">
                                    <span>${escapeHtml(answer.authorName)}</span>
                                </div>
                                <span>${timeAgo}</span>
                                ${deleteButton}
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
        answersListElement.innerHTML = answersHTML;
    } catch (error) {
        console.error('Error loading answers:', error);
    }
}

async function deleteAnswer(answerId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    if (!confirm('Are you sure you want to delete this answer? This action cannot be undone.')) {
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            const answerRef = db.collection('answers').doc(answerId);
            const answerDoc = await transaction.get(answerRef);
            
            if (!answerDoc.exists) {
                throw new Error("Answer does not exist!");
            }
            
            const answerData = answerDoc.data();
            
            if (answerData.authorId !== currentUser.uid) {
                throw new Error("You can only delete your own answers.");
            }
            
            transaction.delete(answerRef);
            
            const questionRef = db.collection('questions').doc(answerData.questionId);
            transaction.update(questionRef, {
                answerCount: firebase.firestore.FieldValue.increment(-1)
            });
            
            const userRef = db.collection('users').doc(currentUser.uid);
            transaction.update(userRef, {
                answersGiven: firebase.firestore.FieldValue.increment(-1),
                reputation: firebase.firestore.FieldValue.increment(-1)
            });
        });
        
        loadAnswers(currentQuestionId);
        loadUserReputation();
        console.log('Answer deleted successfully');
        
    } catch (error) {
        console.error('Error deleting answer:', error);
        alert('Failed to delete answer: ' + error.message);
    }
}

async function submitAnswer(event) {
    event.preventDefault();
    if (!currentUser || !currentQuestionId) { return; }
    const body = document.getElementById('answer-body').value.trim();
    if (!body) { alert('Please write an answer'); return; }
    
    try {
        const answerData = {
            questionId: currentQuestionId,
            body: body,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email,
            authorPhoto: currentUser.photoURL || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            voteCount: 0,
            votes: {}
        };
        
        await db.collection('answers').add(answerData);
        
        await db.collection('questions').doc(currentQuestionId).update({
            answerCount: firebase.firestore.FieldValue.increment(1)
        });
        
        await db.collection('users').doc(currentUser.uid).update({
            answersGiven: firebase.firestore.FieldValue.increment(1),
            reputation: firebase.firestore.FieldValue.increment(1)
        });
        
        document.getElementById('answer-form').reset();
        loadAnswers(currentQuestionId);
        loadUserReputation();
    } catch (error) {
        console.error('Error posting answer:', error);
        alert('Error posting answer. Please try again.');
    }
}

// Event Listeners
function setupEventListeners() {
    // Auth
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    document.getElementById('signup-btn').addEventListener('click', showSignupModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeAuthModal);
    document.getElementById('overlay').addEventListener('click', closeAuthModal);
    document.getElementById('auth-switch-link').addEventListener('click', toggleAuthMode);
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);

    // Main Navigation
    document.getElementById('home-link').addEventListener('click', showHome);
    document.getElementById('ask-question-link').addEventListener('click', showAskQuestion);
    document.getElementById('ask-question-btn-main').addEventListener('click', showAskQuestion);

    // User Menu
    document.getElementById('user-info-wrapper').addEventListener('click', () => toggleUserMenu());
    document.getElementById('profile-link').addEventListener('click', showProfilePage);
    document.getElementById('logout-link').addEventListener('click', logout);
    
    // Forms
    document.getElementById('email-auth-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        signInWithEmail(email, password);
    });
    document.getElementById('ask-question-form').addEventListener('submit', submitQuestion);
    document.getElementById('answer-form').addEventListener('submit', submitAnswer);
    document.getElementById('profile-form').addEventListener('submit', updateUserProfile);
    document.getElementById('cancel-question-btn').addEventListener('click', showHome);
    document.getElementById('cancel-profile-btn').addEventListener('click', showHome);

    // Filters
    document.getElementById('filters').addEventListener('click', function(e) {
        if (e.target.matches('.filter-btn')) {
            filterQuestions(e.target.dataset.filter);
        }
    });
}

// User Menu Dropdown Logic
function toggleUserMenu(forceClose = false) {
    const dropdown = document.getElementById('user-menu-dropdown');
    if (forceClose) {
        dropdown.style.display = 'none';
        return;
    }
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

window.addEventListener('click', function(event) {
    const userMenuNode = document.getElementById('user-menu');
    if (userMenuNode && !userMenuNode.contains(event.target)) {
        toggleUserMenu(true);
    }
});

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeAgo(date) {
    if (!date) return 'Unknown time';
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// Voting Functions
async function voteQuestion(questionId, voteValue) {
    if (!currentUser) { showLoginModal(); return; }
    
    try {
        await db.runTransaction(async (transaction) => {
            const questionRef = db.collection('questions').doc(questionId);
            const questionDoc = await transaction.get(questionRef);
            if (!questionDoc.exists) throw new Error("Question does not exist!");
            
            const questionData = questionDoc.data();
            if (questionData.authorId === currentUser.uid) throw new Error("You cannot vote on your own question.");
            
            const currentVote = questionData.votes[currentUser.uid] || 0;
            let newVote = voteValue === currentVote ? 0 : voteValue;
            let voteChange = newVote - currentVote;
            
            transaction.update(questionRef, {
                voteCount: firebase.firestore.FieldValue.increment(voteChange),
                [`votes.${currentUser.uid}`]: newVote
            });
            
            if (questionData.authorId && voteChange !== 0) {
                const authorRef = db.collection('users').doc(questionData.authorId);
                let repChange = 0;
                if (voteChange === 1) repChange = currentVote === -1 ? 8 : 5;
                else if (voteChange === -1) repChange = currentVote === 1 ? -8 : -3;
                if (repChange !== 0) {
                    transaction.update(authorRef, { reputation: firebase.firestore.FieldValue.increment(repChange) });
                }
            }
        });
        
        loadQuestionDetail(questionId);
        loadUserReputation();
    } catch (error) {
        console.error("Vote transaction failed: ", error);
        alert(error.message);
    }
}

async function voteAnswer(answerId, voteValue) {
    if (!currentUser) { showLoginModal(); return; }
    
    try {
        await db.runTransaction(async (transaction) => {
            const answerRef = db.collection('answers').doc(answerId);
            const answerDoc = await transaction.get(answerRef);
            if (!answerDoc.exists) throw new Error("Answer does not exist!");
            
            const answerData = answerDoc.data();
            if (answerData.authorId === currentUser.uid) throw new Error("You cannot vote on your own answer.");
            
            const currentVote = answerData.votes[currentUser.uid] || 0;
            let newVote = voteValue === currentVote ? 0 : voteValue;
            let voteChange = newVote - currentVote;
            
            transaction.update(answerRef, {
                voteCount: firebase.firestore.FieldValue.increment(voteChange),
                [`votes.${currentUser.uid}`]: newVote
            });
            
            if (answerData.authorId && voteChange !== 0) {
                const authorRef = db.collection('users').doc(answerData.authorId);
                let repChange = 0;
                if (voteChange === 1) repChange = currentVote === -1 ? 8 : 5;
                else if (voteChange === -1) repChange = currentVote === 1 ? -8 : -3;
                if (repChange !== 0) {
                    transaction.update(authorRef, { reputation: firebase.firestore.FieldValue.increment(repChange) });
                }
            }
        });
        
        loadAnswers(currentQuestionId);
        loadUserReputation();
    } catch (error) {
        console.error("Vote transaction failed: ", error);
        alert(error.message);
    }
}

function filterQuestions(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.filter-btn[data-filter="${filter}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    loadQuestions(filter);
}
```html:index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevQ&A - Collaborative Q&A Platform</title>
    <link rel="stylesheet" href="style.css">
    
    <!-- Firebase SDK -->
    <script src="[https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-app-compat.min.js](https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-app-compat.min.js)"></script>
    <script src="[https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-auth-compat.min.js](https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-auth-compat.min.js)"></script>
    <script src="[https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-firestore-compat.min.js](https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-firestore-compat.min.js)"></script>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="container">
            <div class="nav-brand">
                <h1>DevQ&A</h1>
            </div>
            
            <nav class="nav">
                <div class="nav-links">
                    <a href="#" id="home-link" class="nav-link">Home</a>
                    <a href="#" id="ask-question-link" class="nav-link">Ask Question</a>
                </div>
                
                <!-- Authentication Section -->
                <div class="auth-section">
                    <div id="auth-buttons" class="auth-buttons">
                        <button id="login-btn" class="btn btn-outline">Login</button>
                        <button id="signup-btn" class="btn btn-primary">Sign Up</button>
                    </div>
                    
                    <!-- UPDATED: User Menu with Dropdown -->
                    <div id="user-menu" class="user-menu" style="display: none;">
                        <div id="user-info-wrapper" class="user-info-wrapper">
                            <div class="user-info">
                                <img id="user-avatar" src="" alt="User Avatar" class="user-avatar">
                                <span id="user-name">User Name</span>
                                <div class="user-reputation">
                                    <span id="user-rep">0</span> rep
                                </div>
                            </div>
                            <span class="dropdown-arrow">&#9662;</span>
                        </div>
                        <div id="user-menu-dropdown" class="user-menu-dropdown">
                            <a href="#" id="profile-link" class="user-menu-link">Profile</a>
                            <a href="#" id="logout-link" class="user-menu-link">Logout</a>
                        </div>
                    </div>
                </div>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="main">
        <!-- Home Page -->
        <div id="home-page" class="page">
            <div class="container">
                <div class="page-header">
                    <h2>Recent Questions</h2>
                    <button class="btn btn-primary" id="ask-question-btn-main">Ask Question</button>
                </div>
                
                <div id="filters" class="filters">
                    <button class="filter-btn active" data-filter="newest">Newest</button>
                    <button class="filter-btn" data-filter="votes">Most Votes</button>
                    <button class="filter-btn" data-filter="answers">Most Answers</button>
                </div>
                
                <div id="questions-list" class="questions-list">
                    <!-- Questions will be loaded here -->
                    <div class="loading">Loading questions...</div>
                </div>
            </div>
        </div>

        <!-- Ask Question Page -->
        <div id="ask-question-page" class="page" style="display: none;">
            <div class="container">
                <div class="page-header">
                    <h2>Ask a Question</h2>
                </div>
                
                <form id="ask-question-form" class="question-form">
                    <div class="form-group">
                        <label for="question-title">Question Title</label>
                        <input type="text" id="question-title" required 
                               placeholder="What's your programming question? Be specific.">
                        <small>Be specific and imagine you're asking a question to another person</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="question-body">Question Details</label>
                        <textarea id="question-body" rows="10" required 
                                  placeholder="Provide all relevant details. Include any code, error messages, and what you've tried so far."></textarea>
                        <small>Include all the information someone would need to answer your question</small>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" id="cancel-question-btn">Cancel</button>
                        <button type="submit" class="btn btn-primary">Post Question</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Question Detail Page -->
        <div id="question-detail-page" class="page" style="display: none;">
            <div class="container">
                <div id="question-detail" class="question-detail">
                    <!-- Question details will be loaded here -->
                </div>
                
                <div id="answers-section" class="answers-section">
                    <h3 id="answers-count">0 Answers</h3>
                    <div id="answers-list" class="answers-list">
                        <!-- Answers will be loaded here -->
                    </div>
                </div>
                
                <div id="answer-form-section" class="answer-form-section">
                    <h3>Your Answer</h3>
                    <form id="answer-form" class="answer-form">
                        <div class="form-group">
                            <textarea id="answer-body" rows="8" required 
                                      placeholder="Write your answer here..."></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Post Answer</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        
        <!-- NEW: Profile Page -->
        <div id="profile-page" class="page" style="display: none;">
            <div class="container">
                <div class="page-header">
                    <h2>Edit Your Profile</h2>
                </div>

                <form id="profile-form" class="profile-form">
                    <div class="form-group">
                        <label for="profile-email">Email</label>
                        <input type="email" id="profile-email" disabled>
                        <small>Email address cannot be changed.</small>
                    </div>

                    <div class="form-group">
                        <label for="profile-first-name">First Name</label>
                        <input type="text" id="profile-first-name" placeholder="Enter your first name">
                    </div>

                    <div class="form-group">
                        <label for="profile-last-name">Last Name</label>
                        <input type="text" id="profile-last-name" placeholder="Enter your last name">
                    </div>
                    
                    <div class="form-group">
                        <label>Profile Picture</label>
                        <div class="profile-picture-section">
                             <img id="profile-avatar-preview" src="" alt="Avatar Preview" class="profile-avatar-preview">
                             <input type="text" id="profile-photo-url" placeholder="Enter image URL for your profile picture">
                        </div>
                         <small>Provide a direct URL to an image (e.g., from Imgur, Gravatar).</small>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" id="cancel-profile-btn">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    </main>

    <!-- Auth Modals -->
    <div id="auth-modal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="auth-modal-title">Login</h3>
                <button class="close-btn" id="close-modal-btn">&times;</button>
            </div>
            
            <div class="modal-body">
                <!-- Google Sign In -->
                <button id="google-signin-btn" class="btn btn-google">
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAxOCAxOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3LjY0IDkuMjA0ODJDMTC3NjQgOC41NjUzMiAxNy41MjQ5IDcuOTUxMDcgMTcuMzMxOSA3LjMxNTE0SDE5LjAxVjguMzY5NjVIMTYuMTMxMkMxNS44MDcgOC45MzUzOCAxNS40MTk0IDkuNDI4NjQgMTQuOTkyMSA5LjgyNzI2TDE0Ljk5MjEgMTAuMzUxOEgxNi4zMTA4QzE2Ljg5NTcgOS4wNzUwMSAxNy4zMzE5IDcuNjkyOTIgMTcuMzMxOSA2LjEzNjM2VjUuODY5NDJIMTC8MTcuNjQgOS4yMDQ4MloiIGZpbGw9IiM0Mjg1RjQiLz4KPHBhdGggZD0iTTkgMTZDMTEuNjMgMTYgMTMuODEgMTQuODkgMTUuMjQgMTIuOTJMTMuMjQgMTEuNkMxMi41NCAxMi4yMyAxMS41OCAxMi42NiAxMCAxMi42NkM4LjQyIDEyLjY2IDcuNTUgMTEuNTkgNy4yNCAxMC4yN0g1LjIxVjEwLjgxQzYuNDcgMTMuMzEgOC40OSAxNiAxMCAxNloiIGZpbGw9IiMzNEE4NTMiLz4KPHBhdGggZD0iTTcuMjQgMTAuMjdDNi45MyA5LjYxIDYuOTMgOC44NCA3LjI0IDguMThWNy42NEg1LjIxQzQuNTQgOC45NyA0LjU0IDEwLjQ4IDUuMjEgMTEuODFMNy4yNCAxMC4yN1oiIGZpbGw9IiNGQkJDMDUiLz4KPHBhdGggZD0iTTEwIDYuNjdDMTEuNjYgNi42NyAxMy4xIDcuMjYgMTQuMTkgOC4zTDE1Ljk5IDYuNUMxNC4zNCA1LjAzIDEyLjE5IDQuMTcgMTAgNC4xN0M4LjQ5IDQuMTcgNi40NyA2Ljg2IDUuMjEgOS4zNkw3LjI0IDEwLjkwNUM3LjU1IDkuNjIgOC40MiA4LjU1IDEwIDguNTVaIiBmaWxsPSIjRUE0MzM1Ii8+Cjwvc3ZnPgo=" alt="Google">
                    Continue with Google
                </button>
                
                <div class="divider">
                    <span>or</span>
                </div>
                
                <!-- Email/Password Form -->
                <form id="email-auth-form">
                    <div class="form-group">
                        <input type="email" id="auth-email" required placeholder="Email">
                    </div>
                    <div class="form-group">
                        <input type="password" id="auth-password" required placeholder="Password">
                    </div>
                    <button type="submit" class="btn btn-primary" id="auth-submit-btn">Login</button>
                </form>
                
                <div class="auth-switch">
                    <span id="auth-switch-text">Don't have an account?</span>
                    <a href="#" id="auth-switch-link">Sign up</a>
                </div>
            </div>
        </div>
    </div>

    <!-- Overlay -->
    <div id="overlay" class="overlay" style="display: none;"></div>

    <script src="firebase-config.js"></script>
    <script src="app.js"></script>
</body>
</html>
```
